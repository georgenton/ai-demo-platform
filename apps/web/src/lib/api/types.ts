// -----------------------------------------------------------------------------
// Contrato de la API del frontend ↔ backend (Demo 01).
//
// Estos tipos son el "lenguaje compartido" entre apps/web (Next.js) y
// apps/api (NestJS). Espejo manual de los DTOs del backend porque:
//   - No queremos un paquete compartido `@org/contracts` aún (over-engineering
//     para 4 tipos). Cuando lleguen Demos 02–04 y los contratos se
//     multipliquen, evaluamos extraerlos.
//   - Los DTOs del backend están atados a `class-validator` (decoradores).
//     En el frontend no necesitamos validación — confiamos en TypeScript
//     en build-time y en que el backend rechaza inputs inválidos.
//
// Regla de oro: cuando cambies un DTO del backend, actualiza este archivo
// **en el mismo PR**. El compilador no detectará el drift solo.
// -----------------------------------------------------------------------------

/**
 * Identificadores de los demos disponibles. Lo dejamos como union literal
 * para que TypeScript autocomplete y rechace IDs inválidos en tiempo de
 * compilación.
 *
 * 'tutor' (Demo 05) entró como 'coming-soon' — la UI lo muestra
 * deshabilitado mientras se construye. Ver ADR-0012.
 */
export type DemoId =
  | 'rag'
  | 'comparator'
  | 'corpus'
  | 'agent'
  | 'tutor'
  | 'clinical'
  | 'interview'
  | 'notarize'
  | 'loans'
  | 'bi';

// ---------------------------------------------------------------------------
// Ingest — POST /api/v1/ingest  (text/JSON)
// ---------------------------------------------------------------------------

/** Body del endpoint JSON. Espejo de `IngestRequestDto` (apps/api). */
export interface IngestTextRequest {
  /** Nombre o título del documento (lo mostramos en la UI). */
  name: string;
  /** Texto completo extraído del documento. */
  content: string;
  /** Demo al que pertenece este documento. */
  demoId: DemoId;
}

/** Respuesta exitosa de cualquier variante de ingest (JSON o multipart). */
export interface IngestResponse {
  documentId: string;
  chunkCount: number;
}

// ---------------------------------------------------------------------------
// Ingest — POST /api/v1/ingest/file  (multipart/form-data)
// ---------------------------------------------------------------------------

/** Argumentos del upload de PDF desde el browser. */
export interface IngestFileRequest {
  /** Archivo PDF (máx 10 MB — el backend lo valida con ParseFilePipeBuilder). */
  file: File;
  /** Demo al que pertenece este documento. */
  demoId: DemoId;
}

// ---------------------------------------------------------------------------
// Chat — GET /api/v1/chat  (SSE)
// ---------------------------------------------------------------------------

/** Query string del endpoint de chat. Espejo de `ChatQueryDto` (apps/api). */
export interface ChatQuery {
  /** Pregunta del usuario. */
  q: string;
  /** A qué demo apunta la búsqueda. */
  demoId: DemoId;
  /** Cuántos chunks traer del retrieval. Default backend: 5. Rango 1–20. */
  topK?: number;
}

/**
 * Callbacks del stream SSE. Modelamos el ciclo de vida explícito porque
 * EventSource no tiene un "onComplete" propio — usamos `readyState === CLOSED`
 * + el cierre que hace NestJS cuando el LLM termina.
 */
export interface ChatStreamHandlers {
  /** Se invoca por cada token que llega del LLM. */
  onToken: (token: string) => void;
  /** Se invoca una sola vez cuando el stream cierra limpiamente. */
  onDone?: () => void;
  /** Se invoca si la conexión se cae o el server responde con error. */
  onError?: (error: Error) => void;
}

/**
 * Handle devuelto por `subscribeToChat`. Permite cancelar la suscripción
 * desde el componente que la inició (típicamente en el cleanup de useEffect).
 */
export interface ChatSubscription {
  /** Cierra el EventSource. Idempotente: llamar dos veces no rompe nada. */
  close: () => void;
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/**
 * Forma de los errores HTTP que devuelve NestJS por defecto cuando el
 * ValidationPipe global rechaza el body o un guard responde 4xx.
 * Lo usamos para extraer el `message` legible (que puede ser string o array)
 * y mostrarlo al usuario en lugar de un genérico "Bad Request".
 */
export interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}
