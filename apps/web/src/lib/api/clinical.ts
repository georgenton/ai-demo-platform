// -----------------------------------------------------------------------------
// Cliente del módulo Clinical (Demo 06).
//
// Cuatro funciones:
//   - getClinicalPatients(query, signal)       — GET lista + búsqueda
//   - getClinicalPatientDetail(id, signal)     — GET detalle + historia
//   - getClinicalProtocols(query, signal)      — GET catálogo de protocolos
//   - subscribeToClinicalAnalyze(body, h)      — SSE streaming con tool calling
//
// Los tres GET devuelven una promise; el SSE devuelve una subscription handle
// con `close()`. Patrón idéntico a los clients de agent/tutor — ver agent.ts
// si querés referencia cruzada.
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import { openSseStream } from './sse-fetch';
import type {
  ClinicalAnalyzeEvent,
  ClinicalAnalyzeRequest,
  ClinicalAnalyzeStreamHandlers,
  ClinicalAnalyzeSubscription,
  ClinicalListPatientsQuery,
  ClinicalListProtocolsQuery,
  ClinicalPatientDetail,
  ClinicalPatientListResponse,
  ClinicalProtocolListResponse,
} from './types-clinical';

// ---------------------------------------------------------------------------
// Lectura de datos (GET JSON)
// ---------------------------------------------------------------------------

/** GET /api/v1/clinical/patients */
export async function getClinicalPatients(
  query: ClinicalListPatientsQuery = {},
  signal?: AbortSignal,
): Promise<ClinicalPatientListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  const url = qs
    ? `/api/v1/clinical/patients?${qs}`
    : '/api/v1/clinical/patients';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as ClinicalPatientListResponse;
}

/** GET /api/v1/clinical/patients/:id */
export async function getClinicalPatientDetail(
  patientId: string,
  signal?: AbortSignal,
): Promise<ClinicalPatientDetail> {
  const response = await fetch(
    `/api/v1/clinical/patients/${encodeURIComponent(patientId)}`,
    { signal },
  );
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as ClinicalPatientDetail;
}

/** GET /api/v1/clinical/protocols */
export async function getClinicalProtocols(
  query: ClinicalListProtocolsQuery = {},
  signal?: AbortSignal,
): Promise<ClinicalProtocolListResponse> {
  const params = new URLSearchParams();
  if (query.category) params.set('category', query.category);
  const qs = params.toString();
  const url = qs
    ? `/api/v1/clinical/protocols?${qs}`
    : '/api/v1/clinical/protocols';

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as ClinicalProtocolListResponse;
}

// ---------------------------------------------------------------------------
// SSE del análisis con tool calling
// ---------------------------------------------------------------------------

/**
 * Suscribe al stream del análisis clínico.
 *
 * El backend manda eventos con `event: <type>\ndata: <JSON>`. Acá usamos el
 * helper `openSseStream` que ya itera sobre los eventos del transport y
 * deserializamos cada uno como ClinicalAnalyzeEvent discriminado.
 *
 * Si el JSON no parsea o el `type` no es conocido, descartamos ese evento
 * (defensivo) y seguimos — un evento huérfano no debe romper el stream.
 */
export function subscribeToClinicalAnalyze(
  body: ClinicalAnalyzeRequest,
  handlers: ClinicalAnalyzeStreamHandlers,
): ClinicalAnalyzeSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: '/api/v1/clinical/analyze',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      for await (const raw of stream) {
        const event = parseClinicalEvent(raw.type, raw.data);
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
 * Toma `event: <type>` + `data: <JSON>` y reconstruye el ClinicalAnalyzeEvent
 * con `type` adentro del payload, para que el consumer pueda hacer `switch`
 * directo sobre `event.type`.
 *
 * Si el `type` no es uno de los conocidos, devuelve null para que el caller
 * lo descarte sin romper el stream.
 */
function parseClinicalEvent(
  type: string,
  data: string,
): ClinicalAnalyzeEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Whitelist defensiva: solo aceptamos los `type` que nuestro backend declara.
  if (
    type !== 'token' &&
    type !== 'tool_call' &&
    type !== 'tool_result' &&
    type !== 'done' &&
    type !== 'error_event'
  ) {
    return null;
  }
  return { type, ...payload } as ClinicalAnalyzeEvent;
}
