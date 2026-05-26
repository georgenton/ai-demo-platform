// Cliente de los endpoints /api/v1/documents.

import { ApiError, extractErrorMessage } from './client';
import type {
  ChunkSummary,
  DocumentDetail,
  ListDocumentsQuery,
  ListDocumentsResponse,
} from './types-documents';

/** GET /api/v1/documents (paginado, filtro por demoId). */
export async function listDocuments(
  query: ListDocumentsQuery = {},
  signal?: AbortSignal,
): Promise<ListDocumentsResponse> {
  const params = new URLSearchParams();
  if (query.demoId) params.set('demoId', query.demoId);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  const url = qs ? `/api/v1/documents?${qs}` : '/api/v1/documents';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as ListDocumentsResponse;
}

/** GET /api/v1/documents/:id — detalle con content completo. */
export async function getDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentDetail> {
  const response = await fetch(`/api/v1/documents/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as DocumentDetail;
}

/** GET /api/v1/documents/:id/chunks — chunks sin embeddings. */
export async function listDocumentChunks(
  documentId: string,
  signal?: AbortSignal,
): Promise<ChunkSummary[]> {
  const response = await fetch(
    `/api/v1/documents/${encodeURIComponent(documentId)}/chunks`,
    { signal },
  );
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as ChunkSummary[];
}

/**
 * DELETE /api/v1/documents/:id — devuelve 204 sin body.
 * Si el doc no existe, lanza ApiError 404.
 */
export async function deleteDocument(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/v1/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  // 204 No Content — no parseamos body.
}
