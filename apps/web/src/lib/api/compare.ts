// Cliente del endpoint /api/v1/compare (POST + SSE).
//
// EventSource no soporta POST con body, así que usamos `fetch` con
// Accept: text/event-stream y parseamos el stream a mano vía openSseStream.
// El comparador solo emite eventos `data:` con texto plano — los pasamos
// como `onToken` al consumer.

import { openSseStream } from './sse-fetch';
import type {
  CompareRequest,
  CompareStreamHandlers,
  CompareSubscription,
} from './types-compare';

/**
 * Suscribe al stream SSE del comparador. Arranca la request en background y
 * devuelve un handle con `close()`. El handle es síncrono — la conexión se
 * abre en una microtask y los eventos llegan a los handlers.
 *
 * Si arrancar la request falla (4xx/5xx, red caída), invocamos `onError`
 * y no más eventos.
 */
export function subscribeToCompare(
  body: CompareRequest,
  handlers: CompareStreamHandlers,
): CompareSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/compare',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      for await (const event of stream) {
        // El backend del comparador solo emite `data:` con texto del token.
        // Si en el futuro suma eventos tipados, este `if` los discriminaría.
        if (event.type === 'message') {
          handlers.onToken(event.data);
        }
      }
      handlers.onDone?.();
    } catch (err) {
      // Si el caller hizo close() (= abort), no es error — silenciosamente done.
      if (controller.signal.aborted) {
        handlers.onDone?.();
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      handlers.onError?.(error);
    }
  })();

  return {
    close: () => controller.abort(),
  };
}
