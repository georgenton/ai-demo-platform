// -----------------------------------------------------------------------------
// Forma de las respuestas del módulo Documents.
//
// Tres views distintas según el endpoint:
//
//   DocumentSummary:  para la lista. NO incluye `content` (puede ser 100KB
//                     por doc; mandar 50 en un GET de listado sería absurdo).
//   DocumentDetail:   para GET /:id. Incluye `content` completo.
//   ChunkSummary:     para GET /:id/chunks. NO incluye el embedding vector
//                     (1536 floats por chunk = ruido para la UI).
//
// Son interfaces (no clases) — no van por el ValidationPipe (son outputs,
// no inputs). El compilador asegura que el service devuelve la forma correcta.
// -----------------------------------------------------------------------------

export interface DocumentSummary {
  id: string;
  name: string;
  demoId: string;
  /** ISO-8601 string. NestJS serializa Date automáticamente, pero declararlo
   * como string nos da consistencia con lo que ve el cliente HTTP. */
  createdAt: string;
  updatedAt: string;
  /** Cantidad de chunks asociados — útil para la UI sin pedir el detalle. */
  chunkCount: number;
}

export interface DocumentDetail extends DocumentSummary {
  /** Texto completo extraído del documento (puede ser grande). */
  content: string;
}

export interface ListDocumentsResponse {
  items: DocumentSummary[];
  /** Total de filas que matchean el filtro (no el largo de `items`). */
  total: number;
  limit: number;
  offset: number;
}

export interface ChunkSummary {
  id: string;
  index: number;
  content: string;
}
