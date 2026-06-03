// -----------------------------------------------------------------------------
// Eventos SSE del POST /api/v1/clinical/analyze.
//
// Mismo patrón del Demo 04 (Agent): discriminated union por `type`, el
// controller saca el `type` y lo manda como `event:` del SSE; el resto del
// payload va como `data:` JSON.
//
// El frontend hace:
//   const es = new EventSource('...');
//   es.addEventListener('token',       e => { ... });
//   es.addEventListener('tool_call',   e => { ... });
//   es.addEventListener('tool_result', e => { ... });
//   es.addEventListener('done',        e => { es.close(); });
//   es.addEventListener('error_event', e => { ... });
//
// Nombre `error_event`: el SSE estándar reserva `event: error` para errores
// de red/protocolo; no queremos colisionar.
// -----------------------------------------------------------------------------

/**
 * Texto que el LLM va emitiendo. Stream natural — el frontend lo concatena
 * en la burbuja del asistente para dar sensación de "está pensando en voz alta".
 */
export interface ClinicalTokenEvent {
  type: 'token';
  text: string;
}

/**
 * El LLM pidió consultar la base farmacológica con `check_drug_interactions`.
 * Se emite ANTES de ejecutar el lookup para que el panel muestre algo como
 * "Consultando base farmacológica…" mientras corre.
 */
export interface ClinicalToolCallEvent {
  type: 'tool_call';
  toolName: 'check_drug_interactions';
  medications: string[];
}

/**
 * Resultado del tool: las interacciones encontradas (o lista vacía si
 * no hay riesgo conocido entre las drogas consultadas). El frontend lo
 * muestra como un card colapsable.
 */
export interface ClinicalToolResultEvent {
  type: 'tool_result';
  interactions: {
    drugA: string;
    drugB: string;
    severity: 'leve' | 'moderada' | 'grave';
    description: string;
  }[];
}

/**
 * El análisis terminó (el LLM cerró el turn). El frontend para de mostrar
 * el spinner y cierra el EventSource.
 */
export interface ClinicalDoneEvent {
  type: 'done';
  /** Cuántas vueltas tomó el loop. Informativo. */
  turns: number;
}

/**
 * Algo se rompió fatal (LLM caído, paciente no existe, etc.). El frontend
 * muestra el mensaje en un banner de error.
 */
export interface ClinicalErrorEvent {
  type: 'error_event';
  message: string;
}

export type ClinicalEvent =
  | ClinicalTokenEvent
  | ClinicalToolCallEvent
  | ClinicalToolResultEvent
  | ClinicalDoneEvent
  | ClinicalErrorEvent;
