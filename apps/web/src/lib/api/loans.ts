// -----------------------------------------------------------------------------
// Cliente del Demo 09 (Funnel de préstamos).
//
// Funciones:
//   - getLoan(leadId)               — GET /api/v1/loans/:id
//   - listLoans()                   — GET /api/v1/loans
//   - getLoanMetrics()              — GET /api/v1/loans/funnel/metrics
//   - subscribeToLoanChat(req, ...) — POST /api/v1/loans/chat con SSE
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import { openSseStream } from './sse-fetch';
import type {
  LoanChatEvent,
  LoanChatRequest,
  LoanChatStreamHandlers,
  LoanChatSubscription,
  LoanFunnelMetrics,
  LoanLeadDto,
  LoanLeadListItem,
} from './types-loans';

/** GET /api/v1/loans/:id */
export async function getLoan(
  leadId: string,
  signal?: AbortSignal,
): Promise<LoanLeadDto> {
  const response = await fetch(`/api/v1/loans/${encodeURIComponent(leadId)}`, {
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as LoanLeadDto;
}

/** GET /api/v1/loans */
export async function listLoans(
  signal?: AbortSignal,
): Promise<LoanLeadListItem[]> {
  const response = await fetch('/api/v1/loans', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as LoanLeadListItem[];
}

/** GET /api/v1/loans/funnel/metrics */
export async function getLoanMetrics(
  signal?: AbortSignal,
): Promise<LoanFunnelMetrics> {
  const response = await fetch('/api/v1/loans/funnel/metrics', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as LoanFunnelMetrics;
}

/**
 * Suscribe al stream del chat. El backend manda eventos discriminados por
 * `event: <type>` con `data: <JSON>`. Devuelve un objeto con `close()`
 * para cancelar — útil cuando el componente se desmonta a mitad del
 * stream.
 */
export function subscribeToLoanChat(
  request: LoanChatRequest,
  handlers: LoanChatStreamHandlers,
): LoanChatSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/loans/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      for await (const raw of stream) {
        const event = parseLoanChatEvent(raw.type, raw.data);
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

function parseLoanChatEvent(type: string, data: string): LoanChatEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (
    type !== 'token' &&
    type !== 'tool' &&
    type !== 'stage_changed' &&
    type !== 'done' &&
    type !== 'error_event'
  ) {
    return null;
  }
  return { type, ...payload } as LoanChatEvent;
}
