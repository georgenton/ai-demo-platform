// -----------------------------------------------------------------------------
// Forma de los eventos SSE que el AgentController emite al frontend.
//
// El cliente (browser via EventSource) ve eventos del tipo:
//   event: <type>
//   data:  <JSON con el payload>
//
// Cada `AgentEvent` describe exactamente un evento. La discriminated union por
// `type` hace que TS narre el payload sin asserts. El controller toma cada
// evento y lo serializa a MessageEvent { type, data } para @Sse().
// -----------------------------------------------------------------------------

/**
 * Texto que el LLM va emitiendo en cualquier turn (intermedio o final).
 * El frontend lo muestra como "stream de pensamiento + respuesta".
 */
export interface TokenEvent {
  type: 'token';
  text: string;
}

/**
 * El LLM pidió ejecutar SQL. Lo emitimos ANTES de ejecutar para que el
 * frontend muestre "Ejecutando: SELECT ..." y dé sensación de actividad.
 */
export interface ToolCallEvent {
  type: 'tool_call';
  sql: string;
}

/** Resultado de la ejecución exitosa. */
export interface ToolResultEvent {
  type: 'tool_result';
  rowCount: number;
  durationMs: number;
  /** Muestra hasta 10 filas (preview); el resto se truncó. */
  preview: Record<string, unknown>[];
  truncated: boolean;
}

/** La ejecución del tool falló (SQL inválida, error de DB, etc.). */
export interface ToolErrorEvent {
  type: 'tool_error';
  error: string;
}

/** El agente terminó (LLM dijo `end_turn` o se llegó al límite de vueltas). */
export interface DoneEvent {
  type: 'done';
  /** Cuántos turns ejecutó el loop (informativo). */
  turns: number;
  /** `true` si cortamos por el límite de turns, no por decisión del LLM. */
  truncated: boolean;
}

/** Algo se rompió fatal (ej: error del LLM). El loop termina. */
export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type AgentEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | DoneEvent
  | ErrorEvent;
