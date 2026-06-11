// -----------------------------------------------------------------------------
// Cliente del módulo Notarize (Demo 08).
//
// Cuatro funciones — todas HTTP plano contra `/api/v1/notarize/*`. No usamos
// SSE acá: el flujo entero (upload → hash → notarize → analyze) sucede en
// un único request POST que devuelve el documento completo.
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import type {
  NotarizedDocument,
  NotarizeUploadInput,
  VerificationResponse,
} from './types-notarize';

// ---------------------------------------------------------------------------
// POST /api/v1/notarize — sube + notariza + analiza.
// ---------------------------------------------------------------------------

/**
 * Sube un PDF al backend. El multipart lleva el archivo + el `docType` +
 * el `mode` (local | public | both).
 *
 * El backend hace todo en el mismo request: hash, persistencia, anchors,
 * análisis IA. La respuesta es el `NotarizedDocument` completo con sus
 * anchors y su análisis (que puede ser `null` si el LLM falló — el doc
 * queda persistido igual y se puede reintentar).
 *
 * Tiempo típico: 2-5s (Polygon Amoy es lo más lento si se usa `public`
 * o `both`). Llamar con AbortSignal si la UI quiere cancelar.
 */
export async function uploadNotarize(
  input: NotarizeUploadInput,
  signal?: AbortSignal,
): Promise<NotarizedDocument> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('docType', input.docType);
  form.append('mode', input.mode);

  // No seteamos Content-Type — fetch genera el header con boundary correcto.
  const response = await fetch('/api/v1/notarize', {
    method: 'POST',
    body: form,
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as NotarizedDocument;
}

// ---------------------------------------------------------------------------
// GET /api/v1/notarize — listado del tenant.
// ---------------------------------------------------------------------------

/** Devuelve los últimos 50 documentos notarizados del tenant. */
export async function listNotarized(
  signal?: AbortSignal,
): Promise<NotarizedDocument[]> {
  const response = await fetch('/api/v1/notarize', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as NotarizedDocument[];
}

// ---------------------------------------------------------------------------
// GET /api/v1/notarize/:id — detalle.
// ---------------------------------------------------------------------------

export async function getNotarized(
  id: string,
  signal?: AbortSignal,
): Promise<NotarizedDocument> {
  const response = await fetch(`/api/v1/notarize/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as NotarizedDocument;
}

// ---------------------------------------------------------------------------
// GET /api/v1/notarize/:id/verify — re-verifica anchors.
// ---------------------------------------------------------------------------

/**
 * Re-chequea los anchors del documento contra sus providers. Útil para
 * "este PDF de hoy es el mismo que me notarizaron hace 6 meses?".
 */
export async function verifyNotarized(
  id: string,
  signal?: AbortSignal,
): Promise<VerificationResponse> {
  const response = await fetch(
    `/api/v1/notarize/${encodeURIComponent(id)}/verify`,
    { signal },
  );
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as VerificationResponse;
}
