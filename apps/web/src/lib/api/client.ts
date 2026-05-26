// -----------------------------------------------------------------------------
// Cliente HTTP del frontend para hablar con el backend NestJS.
//
// Filosofía:
//   - Funciones puras, sin estado interno. Cada llamada hace UN request.
//   - URLs relativas (`/api/v1/...`) — Next.js rewrites las proxea al backend
//     (ver apps/web/next.config.js). En código nunca aparece el host.
//   - Cero React aquí. Este módulo es agnóstico de UI; los hooks viven aparte.
//   - Errores se lanzan como `ApiError` con el `statusCode` y el `message` que
//     viene del backend — útil para mostrar mensajes claros sin reinventar
//     parsing en cada componente.
// -----------------------------------------------------------------------------

import type {
  ApiErrorPayload,
  ChatQuery,
  ChatStreamHandlers,
  ChatSubscription,
  IngestFileRequest,
  IngestResponse,
  IngestTextRequest,
} from './types';

/**
 * Error tipado para fallas HTTP del backend.
 *
 * Llevar `status` y opcionalmente el payload original permite a la UI tomar
 * decisiones (mostrar el mensaje del backend si vino, distinguir 4xx de 5xx,
 * etc.) sin tener que pasar `Response` crudo por toda la app.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: ApiErrorPayload,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Intenta parsear el body de un Response fallido como el formato de error
 * estándar de NestJS. Si el body no es JSON o no tiene esa forma, usamos
 * el `statusText` como fallback. Nunca lanza — siempre devuelve un mensaje.
 *
 * Exportada porque los demás clients (demos.ts, documents.ts, etc.) la
 * reusan para mantener consistencia en cómo serializan errores HTTP.
 */
export async function extractErrorMessage(
  response: Response,
): Promise<{ message: string; payload?: ApiErrorPayload }> {
  try {
    const payload = (await response.clone().json()) as ApiErrorPayload;
    const raw = payload.message;
    const message = Array.isArray(raw)
      ? raw.join('; ')
      : (raw ?? response.statusText);
    return { message, payload };
  } catch {
    return { message: response.statusText || `HTTP ${response.status}` };
  }
}

// ---------------------------------------------------------------------------
// Ingest (JSON)
// ---------------------------------------------------------------------------

/**
 * Sube un documento como texto plano. Útil para tests, ejemplos hardcodeados
 * o documentos cuyo texto ya está disponible (no necesita extracción).
 *
 * Para PDFs binarios usar `ingestPdf` — es más eficiente (no hay que pasar
 * por una extracción client-side) y el backend hace la extracción server-side.
 */
export async function ingestText(
  body: IngestTextRequest,
  signal?: AbortSignal,
): Promise<IngestResponse> {
  const response = await fetch('/api/v1/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as IngestResponse;
}

// ---------------------------------------------------------------------------
// Ingest (PDF / multipart)
// ---------------------------------------------------------------------------

/**
 * Sube un archivo PDF al endpoint multipart. El backend valida tamaño (<= 10 MB)
 * y mime type (`application/pdf`), extrae el texto y lo indexa.
 *
 * Importante: NO seteamos `Content-Type` manualmente. Cuando el body es un
 * `FormData`, fetch genera el header con el boundary correcto. Setearlo a
 * mano rompe el upload porque el boundary no coincide.
 */
export async function ingestPdf(
  args: IngestFileRequest,
  signal?: AbortSignal,
): Promise<IngestResponse> {
  const form = new FormData();
  form.append('file', args.file);
  form.append('demoId', args.demoId);

  const response = await fetch('/api/v1/ingest/file', {
    method: 'POST',
    body: form,
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as IngestResponse;
}

// ---------------------------------------------------------------------------
// Chat (SSE)
// ---------------------------------------------------------------------------

/**
 * Construye la query string del endpoint de chat. Aislado en función propia
 * para que sea trivial de testear y obvio cómo se serializa `topK` (que es
 * opcional).
 */
function buildChatUrl(query: ChatQuery): string {
  const params = new URLSearchParams({
    q: query.q,
    demoId: query.demoId,
  });
  if (query.topK !== undefined) {
    params.set('topK', String(query.topK));
  }
  return `/api/v1/chat?${params.toString()}`;
}

/**
 * Suscribe al stream SSE de tokens del chat. El backend cierra la conexión
 * cuando el LLM termina; nosotros detectamos eso por `readyState === CLOSED`
 * dentro de `onerror` (EventSource no expone un "onComplete" propio — el
 * cierre limpio del server le llega como error). Diferenciamos cierre limpio
 * vs error real revisando readyState.
 *
 * El handle devuelto permite cancelar manualmente la suscripción (por
 * ejemplo, si el componente se desmonta antes de que termine el stream).
 *
 * NOTA: `EventSource` solo existe en el browser. Esta función no debe
 * invocarse desde Server Components ni desde el server-side de Next.js.
 * El hook `useChatStream` (C2) garantiza el lado cliente con 'use client'.
 */
export function subscribeToChat(
  query: ChatQuery,
  handlers: ChatStreamHandlers,
): ChatSubscription {
  const source = new EventSource(buildChatUrl(query));

  let closed = false;
  const closeOnce = () => {
    if (closed) return;
    closed = true;
    source.close();
  };

  source.onmessage = (event: MessageEvent<string>) => {
    handlers.onToken(event.data);
  };

  source.onerror = () => {
    // CONNECTING (0) = reintentando; OPEN (1) = activo; CLOSED (2) = cerrado.
    // El server cierra la conexión cuando el LLM termina — esto le llega al
    // browser como un 'error' con readyState=CLOSED. Es el "fin feliz" del
    // stream, no un error real.
    if (source.readyState === EventSource.CLOSED) {
      closeOnce();
      handlers.onDone?.();
      return;
    }
    closeOnce();
    handlers.onError?.(new Error('Chat stream connection error'));
  };

  return {
    close: closeOnce,
  };
}
