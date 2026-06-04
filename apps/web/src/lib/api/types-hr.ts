// -----------------------------------------------------------------------------
// Tipos del cliente del Demo 07 (avatar entrevistador HR).
//
// Espejo manual de los DTOs y respuestas del backend:
//   - apps/api/src/app/hr/dto/*
//   - apps/api/src/app/hr/hr-events.ts
//   - shape de Job/JobQuestion/Interview/InterviewAnswer
//     (packages/db/prisma/schema.prisma)
//
// Si el backend cambia el shape, este archivo cambia en el mismo PR
// (regla ADR-0010).
//
// Convención: prefijo `Hr*` para no colisionar con otros conceptos
// (`Job` ya podría tener significado más amplio en la app).
// -----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Catálogo de roles — GET /api/v1/hr/jobs
// ---------------------------------------------------------------------------

/**
 * Un rol del catálogo. Trae lo mínimo para pintar la lista de selección
 * y el detalle: título, descripción, dimensiones que se van a evaluar y
 * total de preguntas (para mostrar el progreso "1/5", "2/5", etc.).
 *
 * NO incluye las preguntas — esas se sirven una por una via /next-question
 * para que el candidato no las pueda anticipar y preparar respuestas
 * robóticas.
 */
export interface HrJobSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  dimensions: string[];
  _count: {
    questions: number;
  };
}

export interface HrJobListResponse {
  items: HrJobSummary[];
  total: number;
}

// ---------------------------------------------------------------------------
// Crear entrevista — POST /api/v1/hr/interviews
// ---------------------------------------------------------------------------

export interface HrCreateInterviewRequest {
  jobId: string;
  candidateName: string;
  /** Cédula u otro identificador externo. Opcional. */
  candidateExternalId?: string;
}

/**
 * Una pregunta de la entrevista, en el orden que el backend la sirve. NO
 * exponemos la rúbrica al frontend.
 */
export interface HrQuestion {
  id: string;
  /** 0-indexed en la secuencia del rol. */
  order: number;
  text: string;
}

/**
 * Respuesta del POST que arranca la entrevista. Trae el id + jobTitle (para
 * mostrarlo en el header de la pantalla de entrevista) + total de preguntas
 * + la primera pregunta lista para que el avatar la diga.
 */
export interface HrCreateInterviewResponse {
  interviewId: string;
  jobTitle: string;
  totalQuestions: number;
  currentQuestion: HrQuestion;
}

// ---------------------------------------------------------------------------
// Siguiente pregunta — GET /api/v1/hr/interviews/:id/next-question
// ---------------------------------------------------------------------------

/**
 * Discriminated union según queden preguntas pendientes. El frontend usa
 * `done` para decidir si avanza a la pantalla de cierre o sigue con
 * preguntas.
 */
export type HrNextQuestionResponse =
  | {
      done: false;
      currentQuestion: HrQuestion;
      /** Cuántas respuestas ya se grabaron. Útil para el progreso visual. */
      answeredCount: number;
    }
  | {
      done: true;
      answeredCount: number;
    };

// ---------------------------------------------------------------------------
// Persistir respuesta — POST /api/v1/hr/interviews/:id/answer
// ---------------------------------------------------------------------------

export interface HrAnswerRequest {
  questionId: string;
  /** Transcripción literal de la respuesta del candidato. Hasta 8000 chars. */
  transcript: string;
  /** Duración en segundos. Opcional. */
  durationSeconds?: number;
}

export interface HrAnswerResponse {
  ok: true;
}

// ---------------------------------------------------------------------------
// Finalizar — POST /api/v1/hr/interviews/:id/finalize  (SSE)
// ---------------------------------------------------------------------------

/**
 * Severidad implícita del scoring por dimensión. El backend no la calcula
 * — el frontend la deriva del `score` para pintar el chip de color.
 * 0-49 = malo, 50-69 = neutro, 70-100 = bueno (rangos sugeridos; ajustable).
 */
export type HrScoringTone = 'bad' | 'neutral' | 'good';

/**
 * Una dimensión evaluada por el LLM. El backend la emite via tool call.
 */
export interface HrDimensionScored {
  name: string;
  /** 0-100. */
  score: number;
  /** Cita corta de la respuesta del candidato que justifica el score. */
  evidence: string;
}

/**
 * El resultado final con recomendación. Lo emite el backend al cierre.
 */
export interface HrFinalResult {
  overall: number;
  recommendation: 'hire' | 'reconsider' | 'reject';
  /** Párrafo de fortalezas. */
  strengths: string;
  /** Párrafo de áreas a profundizar. */
  opportunities: string;
}

/**
 * Eventos SSE del finalize. Discriminated union por `type`. El cliente
 * usa un `switch` directo en `onEvent`.
 *
 * IMPORTANTE: usamos `error_event` (no `error`) porque el SSE estándar
 * reserva `event: error` para errores de protocolo del browser.
 */
export interface HrTokenEvent {
  type: 'token';
  /** Texto del LLM razonando entre tool calls. Puede no aparecer. */
  text: string;
}

export interface HrDimensionScoredEvent extends HrDimensionScored {
  type: 'dimension_scored';
}

export interface HrFinalEvent extends HrFinalResult {
  type: 'final';
}

export interface HrDoneEvent {
  type: 'done';
  turns: number;
}

export interface HrErrorEvent {
  type: 'error_event';
  message: string;
}

export type HrFinalizeEvent =
  | HrTokenEvent
  | HrDimensionScoredEvent
  | HrFinalEvent
  | HrDoneEvent
  | HrErrorEvent;

/**
 * Callbacks del stream del finalize. Mismo patrón que clinical/agent.
 */
export interface HrFinalizeStreamHandlers {
  onEvent: (event: HrFinalizeEvent) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface HrFinalizeSubscription {
  close: () => void;
}
