// -----------------------------------------------------------------------------
// SqlGenerationService — pre-generación de SQL con un modelo especializado
// (típicamente `mannix/defog-llama3-sqlcoder-8b` corriendo en el mismo
// Ollama que el LLM general).
//
// Por qué este servicio existe (decisión del 2026-06-25 con Jorge):
//   qwen2.5:7b en CPU produce SQL torpe para los demos BI/Agent. En lugar
//   de subir a un modelo grande (GPU caro) o fine-tunear, usamos un modelo
//   chico ESPECIALIZADO en text-to-SQL solo para esa parte, y dejamos al
//   LLM general (qwen) hacer lo que sí hace bien: elegir el chart y narrar.
//
// Estrategia "pre-generate then execute":
//   1. SqlGenerationService genera el SQL puro con SQLCoder.
//   2. BiService / AgentService ejecutan ese SQL por la misma capa segura que
//      usa `run_sql`.
//   3. El LLM general recibe un tool_result ya poblado y solo arma narrativa
//      + chart, salvo que el SQL pre-generado haya fallado y necesite corregir.
//
// Cuándo se activa:
//   - Provider activo === `private-mac` y `PRIVATE_LLM_SQL_MODEL` definido.
//   - Provider activo === `private-onprem` y `ONPREM_LLM_SQL_MODEL` definido.
//   - En cualquier otro caso → `null` (cae al flujo normal sin pre-gen).
//
// Anthropic no necesita este servicio: su SQL es excelente sin ayuda.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import type { ChatProvider } from '@org/llm-adapter';

/**
 * Config resuelta para llamar al modelo SQL. Si alguno de los campos
 * obligatorios falta, el servicio devuelve `null` sin intentar la llamada.
 */
interface SqlBackendConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface GenerateOptions {
  /** Provider de chat activo en el request actual. */
  provider: ChatProvider | undefined;
  /** Schema en texto (DDL o catálogo descriptivo) que el modelo usa de contexto. */
  schema: string;
  /** Pregunta del usuario en lenguaje natural. */
  question: string;
  /** Demo que invoca — solo para logging. */
  demoLabel: string;
  /** Cancelación opcional. */
  signal?: AbortSignal;
}

/**
 * Timeout default si las env vars no traen uno. SQLCoder en CPU para
 * Postgres puede tardar ~5-15s; damos 30s de cintura.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Limpia el SQL devuelto por el modelo: quita fences ```sql```, espacios
 * extras y comentarios sueltos al inicio/final. Acepta que el modelo
 * devuelva algo como ```sql\nSELECT ...\n``` con o sin lenguaje.
 */
function stripSqlFences(raw: string): string {
  let text = raw.trim();
  // Remove markdown fence at start.
  text = text.replace(/^```(?:sql)?\s*\n?/i, '');
  // Remove fence at end.
  text = text.replace(/\n?```\s*$/, '');
  return text.trim();
}

@Injectable()
export class SqlGenerationService {
  private readonly logger = new Logger(SqlGenerationService.name);

  /**
   * Resuelve la config del backend SQL según el provider activo. Devuelve
   * `null` si no aplica (Anthropic, o env var del modelo SQL no seteada).
   */
  private resolveConfig(
    provider: ChatProvider | undefined,
  ): SqlBackendConfig | null {
    if (provider === 'private-mac') {
      const baseUrl =
        process.env.PRIVATE_LLM_BASE_URL ?? process.env.CHAT_BASE_URL;
      const apiKey =
        process.env.PRIVATE_LLM_API_KEY ?? process.env.CHAT_API_KEY;
      const model = process.env.PRIVATE_LLM_SQL_MODEL;
      if (!baseUrl || !apiKey || !model) return null;
      return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
    }
    if (provider === 'private-onprem') {
      const baseUrl =
        process.env.ONPREM_LLM_BASE_URL ?? process.env.CHAT_BASE_URL;
      const apiKey = process.env.ONPREM_LLM_API_KEY ?? process.env.CHAT_API_KEY;
      const model = process.env.ONPREM_LLM_SQL_MODEL;
      if (!baseUrl || !apiKey || !model) return null;
      return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
    }
    // Anthropic, openai-compat o fake: el LLM general es suficiente.
    return null;
  }

  /**
   * Intenta pre-generar el SQL con el modelo especializado. Devuelve el
   * SQL limpio o `null` si:
   *   - El provider no aplica.
   *   - La env var del modelo SQL no está seteada.
   *   - El servidor falla o devuelve algo vacío.
   *
   * Los errores se logguean y se traducen en `null` para que el caller
   * caiga al flujo normal sin romper. NUNCA throwea.
   */
  async generateIfAvailable(opts: GenerateOptions): Promise<string | null> {
    const config = this.resolveConfig(opts.provider);
    if (!config) return null;

    const timeoutMs = this.readTimeoutMs(opts.provider);
    const internalController = new AbortController();
    const timer = setTimeout(() => internalController.abort(), timeoutMs);
    // Compose external + internal abort (el caller puede cancelar también).
    const compositeSignal = opts.signal
      ? this.composeAbortSignals(opts.signal, internalController.signal)
      : internalController.signal;

    try {
      const t0 = Date.now();
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        signal: compositeSignal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          // Temperature baja: SQL no es creativo, queremos determinismo.
          temperature: 0.1,
          stream: false,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt(opts.schema),
            },
            {
              role: 'user',
              content: opts.question,
            },
          ],
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `[${opts.demoLabel}] SQL pre-gen HTTP ${response.status}: ${body.slice(0, 200)}`,
        );
        return null;
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) {
        this.logger.warn(
          `[${opts.demoLabel}] SQL pre-gen devolvió content vacío`,
        );
        return null;
      }
      const sql = stripSqlFences(raw);
      if (!sql) return null;
      const dt = Date.now() - t0;
      this.logger.log(
        `[${opts.demoLabel}] SQL pre-gen OK (${config.model}, ${dt}ms): ${sql.slice(0, 80)}...`,
      );
      return sql;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[${opts.demoLabel}] SQL pre-gen falló: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Combina dos `AbortSignal` en uno que aborta cuando cualquiera lo hace.
   * Necesario porque `fetch` no soporta nativamente varios signals.
   */
  private composeAbortSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) controller.abort(s.reason);
      else s.addEventListener('abort', () => controller.abort(s.reason));
    }
    return controller.signal;
  }

  /** Lee el timeout del env var del provider; default 30s. */
  private readTimeoutMs(provider: ChatProvider | undefined): number {
    const raw =
      provider === 'private-mac'
        ? process.env.PRIVATE_LLM_TIMEOUT_MS
        : provider === 'private-onprem'
          ? process.env.ONPREM_LLM_TIMEOUT_MS
          : undefined;
    if (!raw) return DEFAULT_TIMEOUT_MS;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }

  /**
   * System prompt del modelo SQL. Mantenelo CORTO: SQLCoder no necesita
   * persona ni instrucciones largas — entiende mejor el patrón clásico
   * "Dada esta DDL, traduce la pregunta a un SELECT Postgres".
   */
  private systemPrompt(schema: string): string {
    return `### Task
Generate a single PostgreSQL SELECT query that answers the user's question. Use only the tables and columns defined below.

### Database schema
${schema}

### Rules
- Output ONLY the SQL — no explanation, no markdown, no semicolons.
- Use double quotes for identifiers ("BiPrestamo", "montoUsd").
- Use single quotes for string literals ('vigente', '2025-01-01').
- Always alias aggregates with meaningful names (pct_mora, total_socios, cartera_usd).
- Do NOT add a WHERE filter on tenantId — the backend injects it.
- Prefer JOINs over subqueries when readable.
- For "top N", end with ORDER BY ... DESC LIMIT N.
- For percentages use ROUND(100.0 * X / NULLIF(Y, 0), 2).`;
  }

  /**
   * Helper legado para insertar el SQL pre-generado al system prompt del LLM
   * general. El flujo principal ahora pre-ejecuta el SQL, pero lo mantenemos
   * disponible para pruebas o demos donde solo se quiera sugerir el query.
   */
  formatHintForLlm(sql: string): string {
    return `

# Hint del modelo SQL especializado

Para la pregunta del usuario, otro modelo experto en text-to-SQL ya generó este query:

\`\`\`sql
${sql}
\`\`\`

Tu trabajo:
1. Llama \`run_sql\` con ese SQL (ajustalo SOLO si claramente está mal: tabla inexistente, columna mal escrita, etc.).
2. Lee los resultados del tool_result.
3. Elige el chartType apropiado y llama \`render_chart\`.
4. Narra el resultado en 2-4 oraciones de lenguaje de negocio.`;
  }
}
