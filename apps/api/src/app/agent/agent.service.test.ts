// -----------------------------------------------------------------------------
// Tests del AgentService.
//
// El service depende de:
//   - `chat.streamWithTools` (de @org/llm-adapter) — mock con vi.mock que
//     devuelve un AsyncIterable controlado en cada llamada.
//   - `SafeSqlExecutor` (DI) — stub con vi.fn().
//
// Verificamos los tres caminos clave del loop:
//   1) Happy path multi-vuelta: turn 1 pide SQL → ejecutamos → turn 2 redacta
//      respuesta final. El stream emite la secuencia correcta de eventos.
//   2) Error de SQL: el executor devuelve { ok: false }, emitimos `tool_error`
//      Y mandamos el error al LLM como tool_result `isError: true` para que
//      pueda reintentar o disculparse.
//   3) Límite de turns: si el LLM nunca dice `end_turn`, cortamos a MAX_TURNS
//      y marcamos truncated: true.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStreamWithTools } = vi.hoisted(() => ({
  mockStreamWithTools: vi.fn(),
}));

vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: mockStreamWithTools },
}));

import { AgentService } from './agent.service.js';
import type { AgentEvent } from './agent-events.js';
import type { SafeSqlExecutor } from './safe-sql-executor.js';

/** Helper: convierte un array en AsyncIterable, como hace el stream real. */
async function* asStream<T>(items: T[]): AsyncIterable<T> {
  for (const i of items) yield i;
}

async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

describe('AgentService.streamAgent()', () => {
  let executor: SafeSqlExecutor;
  let service: AgentService;

  beforeEach(() => {
    mockStreamWithTools.mockReset();
    executor = { run: vi.fn() } as unknown as SafeSqlExecutor;
    service = new AgentService(executor);
  });

  it('happy path: turn 1 pide SQL → ejecuta → turn 2 responde', async () => {
    // mockReturnValueOnce devuelve referencias al array `messages`; como el
    // service lo MUTA entre turns, leer mock.calls al final del test ve el
    // estado final, no el de cada llamada. Tomamos un snapshot manual en cada
    // call con mockImplementation.
    const callSnapshots: { messages: unknown[] }[] = [];
    const turn1 = asStream([
      { type: 'text_delta', text: 'Voy a consultar.' },
      {
        type: 'tool_use_complete',
        id: 'toolu_1',
        name: 'run_sql',
        input: { sql: 'SELECT COUNT(*) AS c FROM "Student"' },
      },
      { type: 'turn_end', stopReason: 'tool_use' },
    ]);
    const turn2 = asStream([
      { type: 'text_delta', text: 'Hay 50' },
      { type: 'text_delta', text: ' estudiantes.' },
      { type: 'turn_end', stopReason: 'end_turn' },
    ]);
    const responses = [turn1, turn2];
    mockStreamWithTools.mockImplementation((messages: unknown[]) => {
      callSnapshots.push({ messages: JSON.parse(JSON.stringify(messages)) });
      return responses.shift();
    });

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ c: '50' }],
      rowCount: 1,
      durationMs: 12,
      truncated: false,
    });

    const events = await collect(
      service.streamAgent({ q: '¿Cuántos estudiantes hay?' }),
    );

    expect(events).toEqual([
      { type: 'token', text: 'Voy a consultar.' },
      { type: 'tool_call', sql: 'SELECT COUNT(*) AS c FROM "Student"' },
      {
        type: 'tool_result',
        rowCount: 1,
        durationMs: 12,
        preview: [{ c: '50' }],
        truncated: false,
      },
      { type: 'token', text: 'Hay 50' },
      { type: 'token', text: ' estudiantes.' },
      { type: 'done', turns: 2, truncated: false },
    ]);

    // El executor se llamó UNA vez con el SQL exacto.
    expect(executor.run).toHaveBeenCalledOnce();
    expect(executor.run).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS c FROM "Student"',
    );

    // El LLM se llamó DOS veces. Verificamos el snapshot del segundo call:
    // debe llevar el turn previo del assistant + un user con el tool_result.
    expect(callSnapshots).toHaveLength(2);
    const secondMessages = callSnapshots[1].messages as Array<{
      role: string;
      content: unknown;
    }>;
    // [system, user, assistant (text + tool_use), user (tool_result)]
    expect(secondMessages).toHaveLength(4);
    expect(secondMessages[2].role).toBe('assistant');
    expect(secondMessages[3].role).toBe('user');
    expect((secondMessages[3].content as Array<{ type: string }>)[0]).toEqual({
      type: 'tool_result',
      toolUseId: 'toolu_1',
      content: expect.stringContaining('"c":"50"'),
      isError: false,
    });
  });

  it('error de SQL: emite tool_error y manda isError=true al LLM', async () => {
    const callSnapshots: { messages: unknown[] }[] = [];
    const responses = [
      asStream([
        {
          type: 'tool_use_complete',
          id: 'toolu_1',
          name: 'run_sql',
          input: { sql: 'SELECT x FROM "Nope"' },
        },
        { type: 'turn_end', stopReason: 'tool_use' },
      ]),
      asStream([
        { type: 'text_delta', text: 'No pude responder.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]),
    ];
    mockStreamWithTools.mockImplementation((messages: unknown[]) => {
      callSnapshots.push({ messages: JSON.parse(JSON.stringify(messages)) });
      return responses.shift();
    });

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: false,
      error: 'Tabla(s) no permitida(s): Nope.',
    });

    const events = await collect(service.streamAgent({ q: 'algo' }));

    expect(events).toContainEqual({
      type: 'tool_error',
      error: 'Tabla(s) no permitida(s): Nope.',
    });
    expect(events).toContainEqual({ type: 'done', turns: 2, truncated: false });

    // El LLM recibió el error como tool_result con isError: true.
    const secondMessages = callSnapshots[1].messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(
      (secondMessages[3].content as Array<{ isError: boolean }>)[0],
    ).toMatchObject({
      type: 'tool_result',
      toolUseId: 'toolu_1',
      isError: true,
    });
  });

  it('si el LLM pide un tool desconocido, emite tool_error sin tocar el executor', async () => {
    mockStreamWithTools
      .mockReturnValueOnce(
        asStream([
          {
            type: 'tool_use_complete',
            id: 'toolu_1',
            name: 'send_email', // no existe
            input: { to: 'foo' },
          },
          { type: 'turn_end', stopReason: 'tool_use' },
        ]),
      )
      .mockReturnValueOnce(
        asStream([{ type: 'turn_end', stopReason: 'end_turn' }]),
      );

    const events = await collect(service.streamAgent({ q: 'algo' }));

    expect(events.some((e) => e.type === 'tool_error')).toBe(true);
    expect(executor.run).not.toHaveBeenCalled();
  });

  it('corta a MAX_TURNS=5 si el LLM nunca dice end_turn (truncated: true)', async () => {
    // 6 turns todos pidiendo tool_use. El loop debe cortarse a 5.
    const toolUseTurn = () =>
      asStream([
        {
          type: 'tool_use_complete' as const,
          id: 'toolu_X',
          name: 'run_sql' as const,
          input: { sql: 'SELECT 1' },
        },
        { type: 'turn_end' as const, stopReason: 'tool_use' as const },
      ]);
    mockStreamWithTools
      .mockReturnValueOnce(toolUseTurn())
      .mockReturnValueOnce(toolUseTurn())
      .mockReturnValueOnce(toolUseTurn())
      .mockReturnValueOnce(toolUseTurn())
      .mockReturnValueOnce(toolUseTurn())
      .mockReturnValue(toolUseTurn());

    vi.mocked(executor.run).mockResolvedValue({
      ok: true,
      rows: [{ x: 1 }],
      rowCount: 1,
      durationMs: 1,
      truncated: false,
    });

    const events = await collect(service.streamAgent({ q: 'loop infinito' }));
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toEqual({ type: 'done', turns: 5, truncated: true });
    expect(mockStreamWithTools).toHaveBeenCalledTimes(5);
  });

  it('captura excepciones y emite event "error"', async () => {
    mockStreamWithTools.mockImplementation(() => {
      throw new Error('LLM caído');
    });

    const events = await collect(service.streamAgent({ q: 'algo' }));
    expect(events).toEqual([{ type: 'error', message: 'LLM caído' }]);
  });
});
