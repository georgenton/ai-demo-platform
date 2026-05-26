// -----------------------------------------------------------------------------
// Helper para consumir Server-Sent Events sobre `fetch` (POST con body).
//
// Por qué este helper y no `EventSource`:
//   - EventSource solo soporta GET. Demo 02 (compare) y Demo 04 (agent) son
//     POST con JSON body — incompatible con EventSource.
//   - La alternativa estándar es `fetch` con `Accept: text/event-stream` y
//     parsear el body como stream. Es lo que hace esta función.
//
// Protocolo SSE (https://html.spec.whatwg.org/multipage/server-sent-events.html):
//   Cada "event" del stream son una o más líneas seguidas, separadas del
//   siguiente event por una línea en blanco (\n\n). Las líneas son:
//     event: <name>     (opcional; default = 'message')
//     data: <texto>     (puede haber varias; se concatenan con \n)
//     id: <id>          (opcional)
//     retry: <ms>       (opcional)
//
// Esta función NO implementa todo el spec (id/retry no se usan), pero sí lo
// necesario para chat/compare (solo `data:`) y agent (`event:` + `data:`).
// -----------------------------------------------------------------------------

export interface ParsedSseEvent {
  /** Nombre del evento. Default 'message' si no vino `event:`. */
  type: string;
  /** Texto de los `data:` concatenados con \n. */
  data: string;
}

export interface OpenSseStreamOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit | null;
  /** Permite cancelar el stream desde afuera. */
  signal?: AbortSignal;
}

/**
 * Devuelve un AsyncIterable<ParsedSseEvent> que el caller puede iterar con
 * `for await`. Si el server responde !ok, lanza con el body como mensaje.
 * Si el caller llama `signal.abort()`, el iterable termina.
 */
export async function* openSseStream(
  options: OpenSseStreamOptions,
): AsyncIterable<ParsedSseEvent> {
  const response = await fetch(options.url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...options.headers,
    },
    body: options.body,
    signal: options.signal,
  });

  if (!response.ok) {
    // Para errores, intentamos leer el body como texto para dar contexto.
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      detail = response.statusText;
    }
    throw new Error(
      `SSE stream falló con HTTP ${response.status}: ${detail || response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error('Response no trae body — el server no envía SSE.');
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      // Los events SSE están separados por línea en blanco. \n\n marca el fin
      // de un event. El último elemento del split puede ser un event parcial
      // que aún no terminó de llegar — lo guardamos para la próxima iteración.
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const parsed = parseEvent(rawEvent);
        if (parsed) yield parsed;
      }
    }

    // Drain: si quedó algo en el buffer al cerrar, lo procesamos también.
    if (buffer.trim()) {
      const parsed = parseEvent(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    // Liberar el lock del stream — si el caller hace break, sin esto el
    // ReadableStream queda con un reader colgado.
    reader.releaseLock();
  }
}

/**
 * Parsea un bloque de líneas SSE a un { type, data }. Devuelve null si el
 * bloque es comentarios o líneas inválidas (no rompemos por eso).
 */
function parseEvent(raw: string): ParsedSseEvent | null {
  const lines = raw.split('\n');
  let type = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    // Comentarios SSE arrancan con `:` — los ignoramos.
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue; // línea inválida, skip

    const field = line.slice(0, colon);
    // Spec: si después del `:` hay un espacio, se descarta. Si hay dos
    // espacios, solo se descarta uno.
    let value = line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') type = value;
    else if (field === 'data') dataLines.push(value);
    // id / retry ignorados
  }

  if (dataLines.length === 0) return null;
  return { type, data: dataLines.join('\n') };
}
