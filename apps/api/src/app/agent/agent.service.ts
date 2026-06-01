// -----------------------------------------------------------------------------
// AgentService — el orquestador del Demo 04.
//
// Flujo:
//   1) Arranca el LLM con system prompt + pregunta del usuario + definición
//      del tool `run_sql`.
//   2) Por cada turn del LLM:
//      a) Stremea text_deltas → emite SSE `token` (real-time).
//      b) Cuando el LLM termina de pedir un `run_sql`, lo ejecutamos contra
//         la DB con SafeSqlExecutor y emitimos `tool_call` + `tool_result`/
//         `tool_error`.
//      c) Al `turn_end`:
//         - Si stopReason='tool_use': agregamos el turn del assistant + los
//           tool_results al array de mensajes y loopeamos.
//         - Si stopReason='end_turn' (o 'max_tokens'/'other'): salimos.
//   3) Topamos el loop a MAX_TURNS para que un LLM que se obsesione pidiendo
//      tools no quede colgado consumiendo cuota.
//
// Devolvemos un AsyncIterable<AgentEvent>; el controller lo bridgea a SSE.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';
import type {
  ChatRichMessage,
  ChatTool,
  TextBlock,
  ToolUseBlock,
} from '@org/llm-adapter';

import type { AgentEvent } from './agent-events.js';
import type {
  AgentHistoryQueryDto,
  AgentHistoryResponse,
} from './dto/agent-history.dto.js';
import type { AgentQueryDto } from './dto/agent-query.dto.js';
import { SafeSqlExecutor } from './safe-sql-executor.js';

/**
 * System prompt del agente. Le decimos al LLM:
 *   - Qué tablas existen y qué columnas tienen (sin esto inventa).
 *   - Que solo tiene `run_sql` como herramienta y solo lectura.
 *   - Que después de ejecutar SQL debe redactar la respuesta humana al
 *     usuario (cerrar el loop con `end_turn`).
 *   - Que cite los datos puntuales en su respuesta.
 */
const SYSTEM_PROMPT = `Sos un analista de datos académicos. Respondés preguntas sobre estudiantes, cursos, inscripciones y notas, traduciéndolas a SQL contra una base Postgres.

Esquema disponible (solo estas tablas):

- "Course"     (id text, code text, name text, credits int, "createdAt" timestamp)
- "Student"    (id text, "fullName" text, email text, "enrolledAt" timestamp)
- "Enrollment" (id text, "studentId" text, "courseId" text, term text, status "EnrollmentStatus", "createdAt" timestamp)
   FK: "studentId" → "Student".id, "courseId" → "Course".id
   status ∈ ('enrolled', 'withdrawn', 'completed')
- "Grade"      (id text, "enrollmentId" text, "examType" "ExamType", score float, "gradedAt" timestamp)
   FK: "enrollmentId" → "Enrollment".id
   "examType" ∈ ('parcial-1', 'parcial-2', 'final')
   Un score < 60 se considera reprobado.

Reglas:
1. Solo tenés la herramienta \`run_sql\`. Es solo SELECT (lectura). No podés modificar datos.
2. Cuando uses \`run_sql\`, escribí SQL Postgres válida y cita los identificadores con dobles comillas ("Student", "fullName", etc.). Postgres es case-sensitive con identificadores citados.
3. Después de recibir el resultado, redactá una respuesta clara y corta para el usuario en español, mencionando los números concretos.
4. Si la pregunta es ambigua, hacé tu mejor interpretación y aclará el supuesto en la respuesta final.
5. Si la pregunta no se puede responder con el esquema, decilo explícitamente.`;

/** Definición del tool que el LLM puede llamar. */
const RUN_SQL_TOOL: ChatTool = {
  name: 'run_sql',
  description:
    'Ejecuta una consulta SELECT contra la base académica y devuelve las filas. ' +
    'La consulta debe ser una sola sentencia SELECT (o WITH ... SELECT) sobre las ' +
    'tablas "Course", "Student", "Enrollment", "Grade". Cualquier otra cosa será rechazada.',
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'SQL Postgres válida. SELECT-only.',
      },
    },
    required: ['sql'],
  },
};

/** Tope duro de vueltas del loop. Más que esto es señal de un agente confundido. */
const MAX_TURNS = 5;

/** Cantidad de filas que mandamos al frontend como preview de cada tool_result. */
const PREVIEW_ROW_LIMIT = 10;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly executor: SafeSqlExecutor) {}

  async *streamAgent(
    query: AgentQueryDto,
    tenantId: string,
  ): AsyncIterable<AgentEvent> {
    this.logger.log(`Agent query: "${query.q}" (tenant=${tenantId})`);

    const messages: ChatRichMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query.q },
    ];

    const startedAt = Date.now();
    let turns = 0;
    let truncated = false;
    // Audit log: trackeamos el último SQL y rowCount para guardarlos en
    // AgentQuery al final. Si el LLM hace varias llamadas, guardamos la
    // última (decisión documentada en el modelo Prisma).
    let lastSql: string | null = null;
    let lastRowCount: number | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
      while (turns < MAX_TURNS) {
        turns++;

        // Recolectamos los bloques del assistant en este turn para poder
        // armar el "replay" en el array de mensajes (Anthropic lo necesita
        // así para vueltas siguientes).
        const assistantBlocks: (TextBlock | ToolUseBlock)[] = [];
        // Resultados de cada tool_use ejecutado en este turn, para mandar al LLM.
        const toolResults: {
          toolUseId: string;
          content: string;
          isError: boolean;
        }[] = [];
        let stopReason: string = 'other';

        for await (const event of chat.streamWithTools(messages, [
          RUN_SQL_TOOL,
        ])) {
          if (event.type === 'text_delta') {
            // Acumulamos el texto en el último TextBlock o creamos uno nuevo.
            const last = assistantBlocks[assistantBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text += event.text;
            } else {
              assistantBlocks.push({ type: 'text', text: event.text });
            }
            yield { type: 'token', text: event.text };
          } else if (event.type === 'tool_use_complete') {
            // Guardamos el bloque del assistant para el replay.
            assistantBlocks.push({
              type: 'tool_use',
              id: event.id,
              name: event.name,
              input: event.input,
            });

            // Solo soportamos `run_sql` hoy. Si el LLM pidiera otra cosa,
            // devolveríamos un tool_result de error.
            if (event.name !== 'run_sql') {
              const errMsg = `Tool desconocido: "${event.name}". Solo se soporta "run_sql".`;
              yield { type: 'tool_error', error: errMsg };
              errorMessage = errMsg;
              toolResults.push({
                toolUseId: event.id,
                content: errMsg,
                isError: true,
              });
              continue;
            }

            const input = event.input as { sql?: unknown };
            const sql = typeof input.sql === 'string' ? input.sql : '';
            // Audit: guardamos el último SQL que el LLM intentó (haya tenido
            // éxito o no — útil para diagnosticar fallos).
            lastSql = sql;
            yield { type: 'tool_call', sql };

            const result = await this.executor.run(sql);
            if (!result.ok) {
              yield { type: 'tool_error', error: result.error };
              errorMessage = result.error;
              toolResults.push({
                toolUseId: event.id,
                content: `Error ejecutando SQL: ${result.error}`,
                isError: true,
              });
              continue;
            }

            lastRowCount = result.rowCount;
            yield {
              type: 'tool_result',
              rowCount: result.rowCount,
              durationMs: result.durationMs,
              preview: result.rows.slice(0, PREVIEW_ROW_LIMIT),
              truncated: result.truncated,
            };
            // Mandamos al LLM las filas completas (hasta el cap del executor),
            // así puede razonar sobre ellas. Si truncamos, lo decimos en el
            // content para que el LLM lo mencione en su respuesta.
            const payload = {
              rowCount: result.rowCount,
              rows: result.rows,
              truncated: result.truncated,
            };
            toolResults.push({
              toolUseId: event.id,
              content: JSON.stringify(payload),
              isError: false,
            });
          } else if (event.type === 'turn_end') {
            stopReason = event.stopReason;
          }
        }

        // Si el LLM no emitió ningún bloque (raro), igual lo guardamos como
        // turn vacío para no romper el array (Anthropic exige alternancia).
        // En la práctica no debería pasar.
        if (assistantBlocks.length === 0) {
          assistantBlocks.push({ type: 'text', text: '' });
        }
        messages.push({ role: 'assistant', content: assistantBlocks });

        if (stopReason === 'tool_use' && toolResults.length > 0) {
          // Mandamos los tool_results y seguimos el loop.
          messages.push({
            role: 'user',
            content: toolResults.map((tr) => ({
              type: 'tool_result' as const,
              toolUseId: tr.toolUseId,
              content: tr.content,
              isError: tr.isError,
            })),
          });
          continue;
        }

        // end_turn / max_tokens / other → salimos. Solo end_turn cuenta
        // como éxito real (max_tokens es respuesta cortada, other es raro).
        if (stopReason === 'end_turn') success = true;
        yield { type: 'done', turns, truncated };
        return;
      }

      // Salimos del while por límite de turns sin que el LLM diga end_turn.
      truncated = true;
      errorMessage = `Agente cortado por límite de turns (MAX_TURNS=${MAX_TURNS}).`;
      this.logger.warn(`Agent hit MAX_TURNS=${MAX_TURNS} without end_turn`);
      yield { type: 'done', turns, truncated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorMessage = message;
      this.logger.error(`Agent failed: ${message}`);
      yield { type: 'error', message };
    } finally {
      // Audit log best-effort. Si la persistencia falla, NO rompemos el
      // generador — el cliente ya recibió su respuesta; el log es
      // observabilidad, no parte del happy path.
      await this.recordAudit({
        question: query.q,
        sql: lastSql,
        rowCount: lastRowCount,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
        turns,
        tenantId,
      });
    }
  }

  /**
   * Devuelve el historial de queries del agente (audit log) paginado, más
   * recientes primero. Útil para mostrar en una UI "estas son las preguntas
   * que el agente respondió" durante el demo al cliente.
   */
  async findHistory(
    query: AgentHistoryQueryDto,
    tenantId: string,
  ): Promise<AgentHistoryResponse> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [rows, total] = await Promise.all([
      prisma.agentQuery.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.agentQuery.count({ where: { tenantId } }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        question: r.question,
        sql: r.sql,
        rowCount: r.rowCount,
        durationMs: r.durationMs,
        success: r.success,
        errorMessage: r.errorMessage,
        turns: r.turns,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  private async recordAudit(entry: {
    question: string;
    sql: string | null;
    rowCount: number | null;
    durationMs: number;
    success: boolean;
    errorMessage: string | null;
    turns: number;
    tenantId: string;
  }): Promise<void> {
    try {
      await prisma.agentQuery.create({ data: entry });
    } catch (err) {
      // No propagamos: el insert del log no debe matar al stream del demo.
      // Logueamos el error para que aparezca en los logs del server.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to record AgentQuery audit: ${message}`);
    }
  }
}
