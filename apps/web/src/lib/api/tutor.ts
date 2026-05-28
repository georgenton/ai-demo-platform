// -----------------------------------------------------------------------------
// Cliente del módulo Tutor (Demo 05).
//
// Dos funciones:
//   - subscribeToTutorChat(body, handlers) → suscribe al stream SSE, emite
//     token y usage al consumer; devuelve handle con close().
//   - getTutorPricing()                    → un GET JSON, una sola vez al montar
//                                             la página, para el cost calculator.
//
// El protocolo SSE del backend siempre manda `data: {...JSON...}` con eventos
// tipados. Acá hacemos JSON.parse y discriminamos por `type`.
// -----------------------------------------------------------------------------

import { openSseStream } from './sse-fetch';
import type {
  TutorChatRequest,
  TutorPricingResponse,
  TutorStreamEvent,
  TutorStreamHandlers,
  TutorSubscription,
} from './types-tutor';

/**
 * Abre el stream SSE del chat del tutor.
 *
 * El backend manda:
 *   data: {"type":"token","text":"..."}    — repetido
 *   data: {"type":"usage","usage":{...}}   — UNA vez al cierre
 *
 * Tras el evento `usage`, el server cierra la conexión (NestJS lo hace al
 * agotarse el iterable del servicio). Acá llamamos `onDone()` siempre que
 * el iterable termina sin error.
 */
export function subscribeToTutorChat(
  body: TutorChatRequest,
  handlers: TutorStreamHandlers,
): TutorSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/tutor/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      for await (const event of stream) {
        if (event.type !== 'message') continue;
        let parsed: TutorStreamEvent;
        try {
          parsed = JSON.parse(event.data) as TutorStreamEvent;
        } catch {
          // Evento no-JSON — probable broken pipe. Ignoramos y seguimos.
          continue;
        }
        if (parsed.type === 'token') {
          handlers.onToken(parsed.text);
        } else if (parsed.type === 'usage') {
          handlers.onUsage?.(parsed.usage);
        }
      }
      handlers.onDone?.();
    } catch (err) {
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

/**
 * Lee el pricing actual del backend. Se llama una sola vez al montar la
 * página del tutor; la respuesta es JSON pequeño (< 1 KB) y no cambia
 * durante la sesión, así que no vale la pena cachearlo más allá.
 */
export async function getTutorPricing(): Promise<TutorPricingResponse> {
  const response = await fetch('/api/v1/tutor/pricing', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `GET /api/v1/tutor/pricing failed with ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as TutorPricingResponse;
}
