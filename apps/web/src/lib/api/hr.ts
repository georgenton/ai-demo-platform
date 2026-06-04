// -----------------------------------------------------------------------------
// Cliente del módulo HR (Demo 07 — avatar entrevistador).
//
// Funciones:
//   - getHrJobs(signal)                            — GET catálogo de roles
//   - getHrJob(jobId, signal)                      — GET detalle del rol
//   - createHrInterview(body, signal)              — POST crear + 1ra pregunta
//   - getHrNextQuestion(interviewId, signal)       — GET siguiente o done
//   - recordHrAnswer(interviewId, body, signal)    — POST upsert respuesta
//   - subscribeToHrFinalize(interviewId, handlers) — SSE del scoring final
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import { openSseStream } from './sse-fetch';
import type {
  HrAnswerRequest,
  HrAnswerResponse,
  HrCreateInterviewRequest,
  HrCreateInterviewResponse,
  HrFinalizeEvent,
  HrFinalizeStreamHandlers,
  HrFinalizeSubscription,
  HrJobListResponse,
  HrJobSummary,
  HrNextQuestionResponse,
} from './types-hr';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** GET /api/v1/hr/jobs */
export async function getHrJobs(
  signal?: AbortSignal,
): Promise<HrJobListResponse> {
  const response = await fetch('/api/v1/hr/jobs', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as HrJobListResponse;
}

/** GET /api/v1/hr/jobs/:id */
export async function getHrJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<HrJobSummary> {
  const response = await fetch(`/api/v1/hr/jobs/${encodeURIComponent(jobId)}`, {
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as HrJobSummary;
}

// ---------------------------------------------------------------------------
// Entrevistas (flujo)
// ---------------------------------------------------------------------------

/** POST /api/v1/hr/interviews — arranca la sesión y trae la primera pregunta. */
export async function createHrInterview(
  body: HrCreateInterviewRequest,
  signal?: AbortSignal,
): Promise<HrCreateInterviewResponse> {
  const response = await fetch('/api/v1/hr/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as HrCreateInterviewResponse;
}

/** GET /api/v1/hr/interviews/:id/next-question */
export async function getHrNextQuestion(
  interviewId: string,
  signal?: AbortSignal,
): Promise<HrNextQuestionResponse> {
  const response = await fetch(
    `/api/v1/hr/interviews/${encodeURIComponent(interviewId)}/next-question`,
    { signal },
  );
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as HrNextQuestionResponse;
}

/** POST /api/v1/hr/interviews/:id/answer */
export async function recordHrAnswer(
  interviewId: string,
  body: HrAnswerRequest,
  signal?: AbortSignal,
): Promise<HrAnswerResponse> {
  const response = await fetch(
    `/api/v1/hr/interviews/${encodeURIComponent(interviewId)}/answer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as HrAnswerResponse;
}

// ---------------------------------------------------------------------------
// SSE del finalize
// ---------------------------------------------------------------------------

/**
 * Suscribe al stream del scoring final. El backend manda eventos con
 * `event: <type>\ndata: <JSON>`. Acá usamos el helper `openSseStream` que
 * itera sobre los eventos del transport y deserializamos cada uno como
 * HrFinalizeEvent discriminado.
 *
 * Si el JSON no parsea o el `type` no es conocido, descartamos ese evento
 * (defensivo) y seguimos.
 */
export function subscribeToHrFinalize(
  interviewId: string,
  handlers: HrFinalizeStreamHandlers,
): HrFinalizeSubscription {
  const controller = new AbortController();

  (async () => {
    try {
      const stream = openSseStream({
        url: `/api/v1/hr/interviews/${encodeURIComponent(interviewId)}/finalize`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // El finalize no tiene body — el server solo necesita el interviewId
        // del path. Mandamos `{}` para que algunos browsers no marquen el
        // request como "GET implícito" cuando method='POST' y body falta.
        body: '{}',
        signal: controller.signal,
      });

      for await (const raw of stream) {
        const event = parseHrEvent(raw.type, raw.data);
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
 * Toma `event: <type>` + `data: <JSON>` y reconstruye el HrFinalizeEvent
 * con `type` adentro del payload, para que el consumer pueda hacer
 * `switch` directo sobre `event.type`. Whitelist defensiva.
 */
function parseHrEvent(type: string, data: string): HrFinalizeEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (
    type !== 'token' &&
    type !== 'dimension_scored' &&
    type !== 'final' &&
    type !== 'done' &&
    type !== 'error_event'
  ) {
    return null;
  }
  return { type, ...payload } as HrFinalizeEvent;
}
