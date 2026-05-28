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
 * Suscribe al stream SSE de tokens del chat.
 *
 * Cómo detectamos "fin feliz" vs "error real":
 *   El backend cierra la conexión cuando el LLM termina. Para EventSource,
 *   cualquier cierre del server dispara `onerror` — pero contrario a la
 *   intuición, NO siempre con `readyState === CLOSED`. En la práctica el
 *   browser pasa a `CONNECTING` (0) primero porque EventSource intenta
 *   reconectar automáticamente; solo después de varios reintentos termina
 *   en `CLOSED` (2). Si te quedás esperando a `CLOSED` para considerar
 *   "done", **siempre** reportás "error" al final de cada respuesta exitosa.
 *
 *   Estrategia robusta: si ya recibimos al menos un token y después llega
 *   `onerror`, asumimos que fue cierre limpio del server post-respuesta.
 *   Solo reportamos error real cuando `onerror` dispara sin haber recibido
 *   ningún token (típicamente 404, 401, CORS, network down).
 *
 *   Trade-off: si el stream falla MID-respuesta (raro: LLM error después
 *   del primer token), lo vamos a reportar como "done" en lugar de error.
 *   Aceptable — el usuario ve respuesta parcial sin Error UX espurio, y
 *   los errores reales pre-token siguen reportándose.
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
  let receivedAny = false;

  const closeOnce = () => {
    if (closed) return;
    closed = true;
    source.close();
  };

  source.onmessage = (event: MessageEvent<string>) => {
    receivedAny = true;
    handlers.onToken(event.data);
  };

  source.onerror = () => {
    closeOnce();
    if (receivedAny) {
      // Cerramos después de haber recibido tokens → asumimos completion limpio.
      // EventSource transitions a CONNECTING/CLOSED tras el cierre del server;
      // no podemos confiar en readyState para distinguir clean vs error.
      handlers.onDone?.();
      return;
    }
    // No vimos tokens y onerror disparó → error real (404, 401, network down).
    handlers.onError?.(new Error('Chat stream connection error'));
  };

  return {
    close: closeOnce,
  };
}
