// -----------------------------------------------------------------------------
// Cliente HTTP del Demo 03 (Corpus académico).
//
// Cubre 5 endpoints del backend:
//   - POST /api/v1/corpus/upload (multipart batch)
//   - GET  /api/v1/corpus/stats
//   - GET  /api/v1/corpus/papers
//   - GET  /api/v1/corpus/search (SSE)
//   - GET  /api/v1/corpus/summary (SSE)
//
// Los SSE (search / summary) usan el helper `subscribeToEventSource` que
// implementa la heurística de "fin feliz" fixada en PR #41.
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import {
  subscribeToEventSource,
  type EventSourceSubscription,
} from './event-source-stream';
import type {
  CorpusPapersQuery,
  CorpusPapersResponse,
  CorpusSearchHandlers,
  CorpusSearchQuery,
  CorpusSearchSubscription,
  CorpusStats,
  CorpusSummaryHandlers,
  CorpusSummarySubscription,
  CorpusUploadResponse,
} from './types-corpus';

// ===========================================================================
// Upload (multipart batch)
// ===========================================================================

/**
 * POST /api/v1/corpus/upload con uno o varios PDFs.
 *
 * El controller del backend usa `FilesInterceptor('files', 20)`, así que el
 * campo del FormData debe llamarse exactamente `files` y aceptamos hasta 20
 * archivos por request (mismo límite que el server).
 */
export async function uploadCorpusBatch(
  files: File[],
  signal?: AbortSignal,
): Promise<CorpusUploadResponse> {
  if (files.length === 0) {
    throw new ApiError('Sin archivos para subir.', 400, undefined);
  }

  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }

  // No seteamos Content-Type a mano — fetch genera el header multipart con
  // el boundary correcto. Setearlo desde acá rompe el upload.
  const response = await fetch('/api/v1/corpus/upload', {
    method: 'POST',
    body: form,
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as CorpusUploadResponse;
}

// ===========================================================================
// Stats (sin LLM, respuesta inmediata)
// ===========================================================================

/** GET /api/v1/corpus/stats — papers por año + top tópicos + total. */
export async function fetchCorpusStats(
  signal?: AbortSignal,
): Promise<CorpusStats> {
  const response = await fetch('/api/v1/corpus/stats', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as CorpusStats;
}

// ===========================================================================
// Papers (listado paginado)
// ===========================================================================

/** GET /api/v1/corpus/papers — listado paginado con tópicos joined. */
export async function fetchCorpusPapers(
  query: CorpusPapersQuery = {},
  signal?: AbortSignal,
): Promise<CorpusPapersResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  const url = qs ? `/api/v1/corpus/papers?${qs}` : '/api/v1/corpus/papers';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as CorpusPapersResponse;
}

// ===========================================================================
// Search (SSE) — semantic search sobre el corpus
// ===========================================================================

/**
 * GET /api/v1/corpus/search?q=...&topK=5 (SSE).
 * Reusa internamente el ChatService del backend con `demoId='corpus'`.
 */
export function subscribeToCorpusSearch(
  query: CorpusSearchQuery,
  handlers: CorpusSearchHandlers,
): CorpusSearchSubscription {
  const params = new URLSearchParams({ q: query.q });
  if (query.topK !== undefined) params.set('topK', String(query.topK));
  const url = `/api/v1/corpus/search?${params.toString()}`;
  return adaptHandle(subscribeToEventSource(url, handlers));
}

// ===========================================================================
// Summary (SSE) — resumen ejecutivo del corpus via map-reduce
// ===========================================================================

/**
 * GET /api/v1/corpus/summary (SSE).
 *
 * Sin parámetros — toma todo el corpus (cap 50 papers en el server). El
 * cliente solo recibe el resumen final del reduce token a token. El map
 * intermedio (resúmenes por paper) NO se streamea, solo loggea server-side.
 *
 * Tarda ~30-60s la primera vez. Mientras se procesa, el cliente no recibe
 * nada — buen lugar para un loading skeleton en la UI.
 */
export function subscribeToCorpusSummary(
  handlers: CorpusSummaryHandlers,
): CorpusSummarySubscription {
  return adaptHandle(
    subscribeToEventSource('/api/v1/corpus/summary', handlers),
  );
}

// ===========================================================================
// Helper interno: adapter de EventSourceSubscription a las interfaces
// nominales de corpus (CorpusSearchSubscription / CorpusSummarySubscription).
// El shape es idéntico — el adapter es solo para preservar nombres en los
// tipos públicos sin agregar runtime overhead.
// ===========================================================================

function adaptHandle(sub: EventSourceSubscription): {
  close: () => void;
} {
  return { close: sub.close };
}
