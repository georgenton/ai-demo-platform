// -----------------------------------------------------------------------------
// Tests del openSseStream — parser de Server-Sent Events sobre fetch.
//
// Mock de `fetch` que devuelve un Response cuyo body es un ReadableStream
// construido a mano. Así verificamos:
//   - Parseo correcto de líneas `data:` (chat/compare).
//   - Parseo correcto de `event: <type>\ndata: <json>` (agent).
//   - Tolerancia a chunks fragmentados (un event que llega en dos `read()`).
//   - Errores HTTP se propagan con el body como detalle.
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openSseStream, type ParsedSseEvent } from './sse-fetch';

/**
 * Construye un Response cuyo body emite los chunks (strings) en orden, cada
 * uno encodeado como UTF-8 bytes. Imita el shape del fetch real.
 */
function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function collect(
  iter: AsyncIterable<ParsedSseEvent>,
): Promise<ParsedSseEvent[]> {
  const out: ParsedSseEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

describe('openSseStream', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parsea eventos solo-data (chat/compare style)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      streamResponse(['data: Hola\n\ndata: mundo\n\n']),
    );

    const events = await collect(openSseStream({ url: '/x' }));

    expect(events).toEqual([
      { type: 'message', data: 'Hola' },
      { type: 'message', data: 'mundo' },
    ]);
  });

  it('parsea eventos con `event:` + `data:` JSON (agent style)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      streamResponse([
        'event: token\ndata: {"text":"foo"}\n\n',
        'event: tool_call\ndata: {"sql":"SELECT 1"}\n\n',
        'event: done\ndata: {"turns":2,"truncated":false}\n\n',
      ]),
    );

    const events = await collect(openSseStream({ url: '/x' }));

    expect(events).toEqual([
      { type: 'token', data: '{"text":"foo"}' },
      { type: 'tool_call', data: '{"sql":"SELECT 1"}' },
      { type: 'done', data: '{"turns":2,"truncated":false}' },
    ]);
  });

  it('reagrupa eventos fragmentados entre chunks', async () => {
    // Un solo event 'data: hola mundo\n\n' que llega en TRES pedazos.
    vi.mocked(fetch).mockResolvedValue(
      streamResponse(['data: ho', 'la mun', 'do\n\n']),
    );

    const events = await collect(openSseStream({ url: '/x' }));

    expect(events).toEqual([{ type: 'message', data: 'hola mundo' }]);
  });

  it('ignora comentarios (líneas que empiezan con `:`)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      streamResponse([': heartbeat\n\ndata: real\n\n']),
    );

    const events = await collect(openSseStream({ url: '/x' }));

    expect(events).toEqual([{ type: 'message', data: 'real' }]);
  });

  it('lanza si el server responde 4xx/5xx, incluyendo el body en el mensaje', async () => {
    const errorBody = new Response('demoId is required', { status: 400 });
    vi.mocked(fetch).mockResolvedValue(errorBody);

    await expect(collect(openSseStream({ url: '/x' }))).rejects.toThrow(
      /400.*demoId is required/,
    );
  });
});
