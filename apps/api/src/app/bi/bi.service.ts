// -----------------------------------------------------------------------------
// BiService — orquestador del Demo 10 (ADR-0021, sub-PR 2).
//
// Endpoint público: `chat()` — async generator que emite eventos SSE.
//
// Loop idéntico al de LoansService:
//   1. Cargar historial conversacional (en este sub-PR no hay persistencia
//      — el id sirve para que el cliente sepa que es la misma sesión).
//   2. Llamar chat.streamWithTools con BI_TOOLS.
//   3. Por cada tool_use, ejecutar la tool y persistir resultado.
//   4. Re-loopear hasta stopReason !== 'tool_use'.
//
// Las ejecuciones de run_sql pasan por sanitizeBiSql ANTES de tocar la BD.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';
import type {
  ChatProvider,
  ChatRichMessage,
  TextBlock,
  ToolUseBlock,
} from '@org/llm-adapter';
import { chat } from '@org/llm-adapter';

import { SqlGenerationService } from '../sql-generation/sql-generation.service.js';

import type { BiChatEvent, BiChartSpec } from './dto/bi.dto.js';
import { BI_SCHEMA_DDL, BI_SYSTEM_PROMPT } from './prompts.js';
import { sanitizeBiSql, SqlSafetyError } from './sql-safety.js';
import {
  BI_TOOLS,
  parseRenderChartInput,
  parseRunSqlInput,
} from './tools/index.js';

const MAX_TURNS = 6;
const ROWS_LIMIT_FOR_LLM = 50;

const PREEXECUTED_SQL_PROMPT = `

# Resultado SQL pre-ejecutado

Si esta conversación ya incluye un tool_result de \`run_sql\` antes de tu primer
turno, NO repitas \`run_sql\`. Usa esas filas para llamar \`render_chart\` y
narrar el resultado. Solo vuelve a llamar \`run_sql\` si el tool_result previo
es un error o claramente no responde la pregunta.

Cuando ya tengas filas válidas:
- No pidas disculpas ni digas que hubo un error.
- No incluyas markdown de imagen, enlaces, HTML ni texto en otro idioma.
- Después de \`render_chart\`, responde únicamente con 2-4 oraciones en español.`;

@Injectable()
export class BiService {
  private readonly logger = new Logger(BiService.name);

  constructor(private readonly sqlGen: SqlGenerationService) {}

  async *chat(
    tenantId: string,
    input: { conversationId?: string; message: string },
    llmProvider?: ChatProvider,
  ): AsyncGenerator<BiChatEvent> {
    const conversationId = input.conversationId ?? randomUUID();
    this.logger.log(
      `bi chat → conv=${conversationId}, provider=${llmProvider ?? 'env default'}, q="${input.message.slice(0, 120)}"`,
    );

    // Si el provider tiene un modelo SQL especializado configurado
    // (PRIVATE_LLM_SQL_MODEL u ONPREM_LLM_SQL_MODEL), pre-generamos y
    // ejecutamos el SQL antes de invocar al LLM general. El LLM general
    // (qwen) se queda con elegir el chart y narrar — sus dos tareas fáciles.
    // En anthropic el método devuelve null y el flujo sigue como siempre.
    const preGeneratedSql = await this.sqlGen.generateIfAvailable({
      provider: llmProvider,
      schema: BI_SCHEMA_DDL,
      question: input.message,
      demoLabel: 'bi',
    });
    const systemPrompt = preGeneratedSql
      ? BI_SYSTEM_PROMPT + PREEXECUTED_SQL_PROMPT
      : BI_SYSTEM_PROMPT;

    const messages: ChatRichMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.message },
    ];

    let turns = 0;

    try {
      if (preGeneratedSql) {
        const toolUseId = 'sqlcoder_pre_run';
        const result = await this.executeRunSql(
          { sql: preGeneratedSql },
          tenantId,
        );

        messages.push({
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: toolUseId,
              name: 'run_sql',
              input: { sql: preGeneratedSql },
            },
          ],
        });

        if ('error' in result) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId,
                content: result.error,
                isError: true,
              },
            ],
          });
        } else {
          yield {
            type: 'sql',
            sql: result.sanitizedSql,
            tablesUsed: result.tablesUsed,
          };
          yield {
            type: 'rows',
            columns: result.columns,
            rows: result.rows,
            rowCount: result.rows.length,
          };
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId,
                content: JSON.stringify({
                  columns: result.columns,
                  rows: result.rows.slice(0, ROWS_LIMIT_FOR_LLM),
                  rowCountTotal: result.rows.length,
                  truncatedForLlm: result.rows.length > ROWS_LIMIT_FOR_LLM,
                }),
                isError: false,
              },
            ],
          });
        }
      }

      while (turns < MAX_TURNS) {
        turns++;
        const assistantBlocks: (TextBlock | ToolUseBlock)[] = [];
        const toolResults: {
          toolUseId: string;
          content: string;
          isError: boolean;
        }[] = [];
        let stopReason = 'other';

        for await (const event of chat.streamWithTools(messages, BI_TOOLS, {
          provider: llmProvider,
        })) {
          if (event.type === 'text_delta') {
            const last = assistantBlocks[assistantBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text += event.text;
            } else {
              assistantBlocks.push({ type: 'text', text: event.text });
            }
            yield { type: 'token', text: event.text };
          } else if (event.type === 'tool_use_complete') {
            assistantBlocks.push({
              type: 'tool_use',
              id: event.id,
              name: event.name,
              input: event.input,
            });

            if (event.name === 'run_sql') {
              const result = await this.executeRunSql(event.input, tenantId);
              if ('error' in result) {
                toolResults.push({
                  toolUseId: event.id,
                  content: result.error,
                  isError: true,
                });
              } else {
                yield {
                  type: 'sql',
                  sql: result.sanitizedSql,
                  tablesUsed: result.tablesUsed,
                };
                yield {
                  type: 'rows',
                  columns: result.columns,
                  rows: result.rows,
                  rowCount: result.rows.length,
                };
                // El tool_result que devolvemos al LLM lleva las filas
                // (recortadas a ROWS_LIMIT_FOR_LLM para no inflar el
                // contexto cuando el query devuelve cientos de filas).
                toolResults.push({
                  toolUseId: event.id,
                  content: JSON.stringify({
                    columns: result.columns,
                    rows: result.rows.slice(0, ROWS_LIMIT_FOR_LLM),
                    rowCountTotal: result.rows.length,
                    truncatedForLlm: result.rows.length > ROWS_LIMIT_FOR_LLM,
                  }),
                  isError: false,
                });
              }
            } else if (event.name === 'render_chart') {
              const parsed = parseRenderChartInput(event.input);
              if ('error' in parsed) {
                toolResults.push({
                  toolUseId: event.id,
                  content: parsed.error,
                  isError: true,
                });
              } else {
                yield { type: 'chart', spec: parsed satisfies BiChartSpec };
                toolResults.push({
                  toolUseId: event.id,
                  content: 'OK — gráfico solicitado.',
                  isError: false,
                });
              }
            } else {
              toolResults.push({
                toolUseId: event.id,
                content: `Tool desconocido: "${event.name}".`,
                isError: true,
              });
            }
          } else if (event.type === 'turn_end') {
            stopReason = event.stopReason;
          }
        }

        if (assistantBlocks.length === 0) {
          assistantBlocks.push({ type: 'text', text: '' });
        }
        messages.push({ role: 'assistant', content: assistantBlocks });

        if (stopReason === 'tool_use' && toolResults.length > 0) {
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
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`bi chat failed: ${message}`);
      yield { type: 'error_event', message };
      return;
    }

    yield { type: 'done', conversationId, turns };
  }

  // -------------------------------------------------------------------------
  // Ejecución de run_sql con sanitización
  // -------------------------------------------------------------------------

  private async executeRunSql(
    input: unknown,
    tenantId: string,
  ): Promise<
    | {
        sanitizedSql: string;
        tablesUsed: string[];
        columns: string[];
        rows: unknown[][];
      }
    | { error: string }
  > {
    const parsed = parseRunSqlInput(input);
    if ('error' in parsed) return { error: parsed.error };

    let sanitized;
    try {
      sanitized = sanitizeBiSql(parsed.sql, tenantId);
    } catch (err) {
      if (err instanceof SqlSafetyError) {
        return { error: `SQL rechazado por seguridad: ${err.message}` };
      }
      throw err;
    }

    let result: Array<Record<string, unknown>>;
    try {
      result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        sanitized.sanitized,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Mensaje pedagógico para que el LLM corrija — incluye un hint del
      // error Postgres (sin la query completa que ya conoce).
      return {
        error: `Error de Postgres al ejecutar: ${message.slice(0, 300)}. Revisa nombres de columnas/tablas y sintaxis.`,
      };
    }

    if (result.length === 0) {
      return {
        sanitizedSql: sanitized.sanitized,
        tablesUsed: sanitized.tablesUsed,
        columns: [],
        rows: [],
      };
    }

    // Convertir array de objetos a (columns, rows). Mantiene orden de
    // columnas del primer row — Postgres lo respeta.
    const columns = Object.keys(result[0]);
    const rows = result.map((r) =>
      columns.map((c) => {
        const v = r[c];
        // BigInt y Decimal a string para que el JSON serialice.
        if (typeof v === 'bigint') return v.toString();
        if (v !== null && typeof v === 'object' && 'toFixed' in (v as object)) {
          return (v as { toString(): string }).toString();
        }
        return v;
      }),
    );

    return {
      sanitizedSql: sanitized.sanitized,
      tablesUsed: sanitized.tablesUsed,
      columns,
      rows,
    };
  }
}
