// -----------------------------------------------------------------------------
// Tipos del cliente del asistente clínico (Demo 06).
//
// Espejo manual de los DTOs y respuestas del backend:
//   - apps/api/src/app/clinical/dto/*
//   - apps/api/src/app/clinical/clinical-events.ts
//   - shape de Patient/Consultation/ClinicalProtocol (packages/db/prisma/schema.prisma)
//
// Si el backend cambia el shape, este archivo cambia en el mismo PR. Eso es
// la regla del proyecto (ADR-0010, "Web/API coupling: duplicated types").
//
// Convención de naming: prefijo `Clinical*` para evitar colisión con
// primitivas más generales (Patient ya podría querer existir como tipo de
// dominio del lado app — acá lo dejamos como `ClinicalPatient*`).
// -----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lista de pacientes — GET /api/v1/clinical/patients
// ---------------------------------------------------------------------------

/**
 * Una entrada de la lista de pacientes. Trae solo lo que el panel izquierdo
 * de la UI necesita para renderizar la tarjeta corta — el detalle completo
 * se pide aparte cuando el médico selecciona uno.
 */
export interface ClinicalPatientSummary {
  id: string;
  displayName: string;
  age: number;
  gender: string; // 'M' | 'F' por convención del seed, pero el server no lo restringe.
  chronicConditions: string[];
}

/** Query del listado. Todos opcionales. */
export interface ClinicalListPatientsQuery {
  /** Filtro por nombre, case-insensitive, substring match. */
  search?: string;
  /** Máximo de resultados. Default backend: 50, cap: 200. */
  limit?: number;
}

/** Respuesta del listado. */
export interface ClinicalPatientListResponse {
  items: ClinicalPatientSummary[];
  /** Cantidad devuelta en este request — útil para mostrar "N pacientes". */
  total: number;
}

// ---------------------------------------------------------------------------
// Detalle del paciente — GET /api/v1/clinical/patients/:id
// ---------------------------------------------------------------------------

/**
 * Una consulta médica histórica. Espejo de Consultation en Prisma con la
 * fecha serializada como string ISO (Prisma → JSON → string).
 */
export interface ClinicalConsultation {
  id: string;
  /** ISO string. El frontend la parsea con `new Date(...)` si la necesita. */
  date: string;
  treatingPhysician: string;
  reasonForVisit: string;
  examFindings: string | null;
  diagnosis: string;
  treatment: string;
  notes: string | null;
}

/**
 * Detalle completo del paciente: todos sus datos + sus últimas 10 consultas
 * (DESC por fecha). El backend ya las ordena, el frontend solo renderiza.
 */
export interface ClinicalPatientDetail {
  id: string;
  /** Identificador externo opcional — para el día que se importen pacientes reales. */
  externalId: string | null;
  displayName: string;
  age: number;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  /** Hasta 10 consultas, más recientes primero. */
  consultations: ClinicalConsultation[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Protocolos clínicos — GET /api/v1/clinical/protocols
// ---------------------------------------------------------------------------

/**
 * Un protocolo del catálogo. `content` es markdown crudo — el frontend lo
 * renderiza con el componente de markdown que uses (lo mismo que el demo
 * RAG si reusas).
 */
export interface ClinicalProtocol {
  id: string;
  title: string;
  /**
   * Categoría libre del backend. En el seed actual son:
   * 'cardiologia' | 'urgencias' | 'medicina-interna' | 'pediatria' | 'atencion-primaria'.
   * Si llega otro valor, mostralo como categoría genérica.
   */
  category: string;
  content: string;
}

export interface ClinicalListProtocolsQuery {
  /** Categoría exacta a filtrar; si se omite, devuelve todos. */
  category?: string;
}

export interface ClinicalProtocolListResponse {
  items: ClinicalProtocol[];
  total: number;
}

// ---------------------------------------------------------------------------
// Análisis con SSE + tool calling — POST /api/v1/clinical/analyze
// ---------------------------------------------------------------------------

/** Body del POST. */
export interface ClinicalAnalyzeRequest {
  patientId: string;
  question: string;
}

/** Severidad de una interacción farmacológica. */
export type ClinicalInteractionSeverity = 'leve' | 'moderada' | 'grave';

/** Una interacción medicamentosa encontrada por el tool. */
export interface ClinicalInteraction {
  drugA: string;
  drugB: string;
  severity: ClinicalInteractionSeverity;
  description: string;
}

/**
 * Eventos del SSE del análisis. Discriminated union por `type`. El cliente
 * usa un `switch` directo en `onEvent`.
 *
 * IMPORTANTE — naming del error event: el SSE estándar reserva `event: error`
 * para errores de protocolo del browser. Por eso usamos `error_event` en el
 * payload para evitar colisión.
 */
export interface ClinicalTokenEvent {
  type: 'token';
  /** Trozo de texto que el LLM va emitiendo. Concatenar en orden. */
  text: string;
}

export interface ClinicalToolCallEvent {
  type: 'tool_call';
  toolName: 'check_drug_interactions';
  /** Lista de medicaciones que el LLM pasó al tool. */
  medications: string[];
}

export interface ClinicalToolResultEvent {
  type: 'tool_result';
  /** Lista vacía si no se encontró ninguna interacción conocida. */
  interactions: ClinicalInteraction[];
}

export interface ClinicalDoneEvent {
  type: 'done';
  /** Cuántas vueltas del loop de tool calling tomó. Informativo. */
  turns: number;
}

export interface ClinicalErrorEvent {
  type: 'error_event';
  message: string;
}

export type ClinicalAnalyzeEvent =
  | ClinicalTokenEvent
  | ClinicalToolCallEvent
  | ClinicalToolResultEvent
  | ClinicalDoneEvent
  | ClinicalErrorEvent;

/**
 * Callbacks del stream del análisis. El consumer recibe el evento ya
 * deserializado y discriminado por `type` — listo para un switch.
 */
export interface ClinicalAnalyzeStreamHandlers {
  onEvent: (event: ClinicalAnalyzeEvent) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface ClinicalAnalyzeSubscription {
  close: () => void;
}
