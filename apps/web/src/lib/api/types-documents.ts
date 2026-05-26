// Tipos espejo de los endpoints /api/v1/documents.
// Ver ADR-0010 para la decisión de duplicar tipos vs paquete compartido.

import type { DemoId } from './types';

export interface DocumentSummary {
  id: string;
  name: string;
  demoId: DemoId;
  /** ISO-8601 string. */
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface DocumentDetail extends DocumentSummary {
  /** Texto completo extraído del documento. */
  content: string;
}

export interface ListDocumentsQuery {
  demoId?: DemoId;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsResponse {
  items: DocumentSummary[];
  /** Total de filas que matchean el filtro (no `items.length`). */
  total: number;
  limit: number;
  offset: number;
}

export interface ChunkSummary {
  id: string;
  index: number;
  content: string;
}
