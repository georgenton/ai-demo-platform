// -----------------------------------------------------------------------------
// Tipos espejo de los endpoints /api/v1/corpus/* (Demo 03 — Corpus académico).
//
// Mantener tipos espejo en frontend (vs paquete @org/contracts compartido)
// está justificado en ADR-0010. Si el backend cambia el shape, este archivo
// es el lugar a actualizar.
// -----------------------------------------------------------------------------

// ===========================================================================
// Upload
// ===========================================================================

/** Un paper procesado exitosamente — devuelto por POST /corpus/upload. */
export interface CorpusUploadItem {
  documentId: string;
  name: string;
  /** Título extraído por LLM (puede diferir del nombre del archivo). */
  title: string;
  /** Año si el LLM lo encontró. */
  year: number | null;
  authors: string[];
  topics: string[];
  chunkCount: number;
}

/** Respuesta del batch upload. */
export interface CorpusUploadResponse {
  items: CorpusUploadItem[];
  successCount: number;
  /** Cantidad de archivos que el server rechazó. Detalles solo en logs server. */
  failureCount: number;
}

// ===========================================================================
// Stats
// ===========================================================================

/** Una entrada del bar chart de papers/año. */
export interface PapersByYearItem {
  year: number;
  count: number;
}

/** Una entrada del top de tópicos. */
export interface TopTopicItem {
  topic: string;
  count: number;
}

/** Respuesta de GET /corpus/stats. */
export interface CorpusStats {
  totalPapers: number;
  /** Ordenado por año ascendente. Excluye papers sin año. */
  papersByYear: PapersByYearItem[];
  /** Top 10 tópicos por frecuencia descendente. */
  topTopics: TopTopicItem[];
}

// ===========================================================================
// Papers (listado paginado)
// ===========================================================================

/** Filtros opcionales para GET /corpus/papers. */
export interface CorpusPapersQuery {
  limit?: number;
  offset?: number;
}

/** Un paper del listado — sin abstract (es grande; pedir detalle con
 *  GET /api/v1/documents/:id si hace falta). */
export interface CorpusPaperItem {
  id: string;
  name: string;
  year: number | null;
  authors: string[];
  topics: string[];
  /** ISO string del createdAt. */
  createdAt: string;
}

/** Respuesta paginada. */
export interface CorpusPapersResponse {
  items: CorpusPaperItem[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// Search (SSE)
// ===========================================================================

export interface CorpusSearchQuery {
  q: string;
  topK?: number;
}

/** Handlers del stream SSE de search — mismo shape que el chat del Demo 01. */
export interface CorpusSearchHandlers {
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface CorpusSearchSubscription {
  close: () => void;
}

// ===========================================================================
// Summary (SSE)
// ===========================================================================

/** Handlers del stream del executive summary. Idéntico al search en shape;
 *  los separamos por claridad semántica. */
export interface CorpusSummaryHandlers {
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface CorpusSummarySubscription {
  close: () => void;
}
