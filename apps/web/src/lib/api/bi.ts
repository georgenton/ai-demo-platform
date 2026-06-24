// -----------------------------------------------------------------------------
// Cliente del Demo 10 (BI dinámico).
//
// Una sola función pública: subscribeToBiChat — abre el SSE contra
// POST /api/v1/bi/chat y entrega los eventos al handler.
// -----------------------------------------------------------------------------

import { openSseStream } from './sse-fetch';
import type {
  BiChatEvent,
  BiChatRequest,
  BiChatStreamHandlers,
  BiChatSubscription,
} from './types-bi';

export function subscribeToBiChat(
  request: BiChatRequest,
  handlers: BiChatStreamHandlers,
): BiChatSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/bi/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      for await (const raw of stream) {
        const event = parseBiChatEvent(raw.type, raw.data);
        if (event) handlers.onEvent(event);
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

function parseBiChatEvent(type: string, data: string): BiChatEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (
    type !== 'token' &&
    type !== 'sql' &&
    type !== 'rows' &&
    type !== 'chart' &&
    type !== 'done' &&
    type !== 'error_event'
  ) {
    return null;
  }
  return { type, ...payload } as BiChatEvent;
}
