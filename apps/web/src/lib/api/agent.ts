// Cliente de los endpoints /api/v1/agent (POST + SSE tipado) y /agent/history.

import { ApiError, extractErrorMessage } from './client';
import { openSseStream } from './sse-fetch';
import type {
  AgentEvent,
  AgentHistoryQuery,
  AgentHistoryResponse,
  AgentRequest,
  AgentStreamHandlers,
  AgentSubscription,
} from './types-agent';

/**
 * Suscribe al stream del agente. A diferencia del comparador, el agente
 * emite eventos TIPADOS (token / tool_call / tool_result / tool_error /
 * done / error). El servidor manda `event: <type>\ndata: <JSON>` por cada
 * evento; acá lo deserializamos y lo entregamos como AgentEvent discriminado
 * para que el consumer pueda usar un `switch` directo.
 */
export function subscribeToAgent(
  body: AgentRequest,
  handlers: AgentStreamHandlers,
): AgentSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/agent',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      for await (const raw of stream) {
        const event = parseAgentEvent(raw.type, raw.data);
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

/**
 * Toma `event: <type>` + `data: <JSON>` del SSE y arma el AgentEvent tipado.
 * Si el JSON no parsea o el `type` no es uno conocido, devuelve null
 * (defensivo — el server no debería mandar eventos desconocidos, pero si lo
 * hace no rompemos el stream entero).
 */
function parseAgentEvent(type: string, data: string): AgentEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  // El AgentEvent del backend incluye `type` dentro del payload del SSE? No
  // — el controller extrae `type` para el campo `event:` y manda el resto
  // como `data:`. Acá reconstruimos el objeto fusionando.
  return { type, ...payload } as AgentEvent;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** GET /api/v1/agent/history (paginado, más recientes primero). */
export async function getAgentHistory(
  query: AgentHistoryQuery = {},
  signal?: AbortSignal,
): Promise<AgentHistoryResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  const url = qs ? `/api/v1/agent/history?${qs}` : '/api/v1/agent/history';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as AgentHistoryResponse;
}
