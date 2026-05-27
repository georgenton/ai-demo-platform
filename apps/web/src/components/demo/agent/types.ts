// -----------------------------------------------------------------------------
// Tipos internos de la consola del agente.
//
// Mapeamos los eventos SSE del backend (`AgentEvent` en lib/api/types-agent.ts)
// a un shape visual `AgentRunEvent` que la UI pinta en cards. La diferencia
// principal: los `token` events del backend (uno por delta de texto) los
// fusionamos en un único bloque `answer` que va acumulando texto y muestra
// el cursor parpadeante mientras streamea. Cualquier evento no-token cierra
// el bloque `answer` en curso, y el próximo token arranca uno nuevo (Loop
// multi-vuelta: "Pensando..." → SQL → Result → "Basado en..." → Done).
// -----------------------------------------------------------------------------

export type AgentRunEvent =
  /** Pregunta del usuario (lo agregamos al iniciar el run). */
  | { kind: 'question'; text: string }
  /**
   * Placeholder mientras esperamos el primer evento del backend.
   * Aparece después de question y se remueve apenas llega algo real.
   */
  | { kind: 'thinking'; label?: string }
  /** El LLM pidió correr SQL (mapeado de `tool_call`). */
  | { kind: 'sql'; sql: string }
  /** Resultado de la ejecución del SQL (mapeado de `tool_result`). */
  | {
      kind: 'result';
      rowCount: number;
      durationMs: number;
      preview: Record<string, unknown>[];
      truncated: boolean;
    }
  /** Error no fatal del SQL: el agente puede reintentar (mapeado de `tool_error`). */
  | { kind: 'tool_error'; error: string }
  /** Bloque de respuesta del LLM, acumulado a partir de `token` events. */
  | { kind: 'answer'; text: string; streaming: boolean }
  /** Cierre normal del run (mapeado de `done`). */
  | { kind: 'done'; turns: number; truncated: boolean }
  /** Error fatal del agente — el run no completó (mapeado de `error`). */
  | { kind: 'error'; message: string };

export type AgentRunStatus = 'idle' | 'running' | 'done' | 'error';
