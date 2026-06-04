// -----------------------------------------------------------------------------
// Eventos SSE del POST /api/v1/hr/interviews/:id/finalize.
//
// Mismo patrón del Demo 06 (Clinical): discriminated union por `type`, el
// controller saca el `type` y lo manda como `event:` del SSE; el resto del
// payload va como `data:` JSON.
//
// Por qué eventos incrementales en vez de un solo payload final:
// la pantalla de cierre del demo se siente "viva" cuando el reclutador ve
// las dimensiones aparecer una por una a medida que el LLM las evalúa
// (mismo principio que el tool calling del clinical). Un solo payload de 1KB
// llegando al final no transmite el "el sistema está pensando".
// -----------------------------------------------------------------------------

/**
 * Texto que el LLM va emitiendo entre tool calls. Puede que no aparezca si
 * el LLM va directo a las tools, pero lo emitimos por si razona "en voz alta".
 */
export interface HrTokenEvent {
  type: 'token';
  text: string;
}

/**
 * El LLM cerró el scoring de una dimensión. La emitimos apenas el tool
 * `score_dimension` se completa, así la UI puede pintarla con animación
 * de entrada. Una entrevista de 4-5 dimensiones genera 4-5 de estos.
 */
export interface HrDimensionScoredEvent {
  type: 'dimension_scored';
  name: string;
  /** 0 a 100. */
  score: number;
  /** Cita corta del LLM justificando el score (1 línea). */
  evidence: string;
}

/**
 * El LLM cerró el resultado final con recomendación. Se emite una sola vez,
 * después de todos los `dimension_scored`.
 */
export interface HrFinalEvent {
  type: 'final';
  /** Score global 0 a 100, no necesariamente promedio simple de dimensiones. */
  overall: number;
  /**
   * `hire` = recomendado pasar a siguiente etapa.
   * `reconsider` = perfil con dudas, vale otra mirada.
   * `reject` = no recomendado.
   */
  recommendation: 'hire' | 'reconsider' | 'reject';
  /** Párrafo de fortalezas observadas. */
  strengths: string;
  /** Párrafo de áreas a profundizar / oportunidades de mejora. */
  opportunities: string;
}

/**
 * Cierre del stream. El frontend cierra el EventSource al recibirlo.
 */
export interface HrDoneEvent {
  type: 'done';
  /** Cuántas vueltas tomó el loop de tool calling. Informativo. */
  turns: number;
}

/**
 * Error fatal. No usamos `event: error` porque el SSE estándar lo reserva
 * para errores de protocolo.
 */
export interface HrErrorEvent {
  type: 'error_event';
  message: string;
}

export type HrEvent =
  | HrTokenEvent
  | HrDimensionScoredEvent
  | HrFinalEvent
  | HrDoneEvent
  | HrErrorEvent;
