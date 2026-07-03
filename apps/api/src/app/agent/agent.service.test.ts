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

const {
  mockStreamWithTools,
  mockAgentQueryCreate,
  mockAgentQueryFindMany,
  mockAgentQueryCount,
} = vi.hoisted(() => ({
  mockStreamWithTools: vi.fn(),
  mockAgentQueryCreate: vi.fn(),
  mockAgentQueryFindMany: vi.fn(),
  mockAgentQueryCount: vi.fn(),
}));

vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: mockStreamWithTools },
}));

vi.mock('@org/db', () => ({
  prisma: {
    agentQuery: {
      create: mockAgentQueryCreate,
      findMany: mockAgentQueryFindMany,
      count: mockAgentQueryCount,
    },
  },
}));

import { SqlGenerationService } from '../sql-generation/sql-generation.service.js';

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
  let sqlGen: SqlGenerationService;
  let service: AgentService;

  beforeEach(() => {
    mockStreamWithTools.mockReset();
    mockAgentQueryCreate.mockReset();
    mockAgentQueryFindMany.mockReset();
    mockAgentQueryCount.mockReset();
    // Por defecto el insert del audit log succeeds — no nos rompe los tests.
    mockAgentQueryCreate.mockResolvedValue({ id: 'audit-1' });
    executor = { run: vi.fn() } as unknown as SafeSqlExecutor;
    // SqlGenerationService stub: por default devuelve null (no hay SQL model
    // configurado), igual al runtime cuando el provider es anthropic o cuando
    // PRIVATE_LLM_SQL_MODEL / ONPREM_LLM_SQL_MODEL no están seteadas.
    sqlGen = {
      generateIfAvailable: vi.fn().mockResolvedValue(null),
      formatHintForLlm: vi.fn(),
    } as unknown as SqlGenerationService;
    service = new AgentService(executor, sqlGen);
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

  it('normaliza tablas académicas en minúscula cuando el LLM llama run_sql', async () => {
    mockStreamWithTools
      .mockReturnValueOnce(
        asStream([
          {
            type: 'tool_use_complete',
            id: 'toolu_1',
            name: 'run_sql',
            input: {
              sql: 'SELECT COUNT(*) AS c FROM students s JOIN enrollments e ON e."studentId" = s.id',
            },
          },
          { type: 'turn_end', stopReason: 'tool_use' },
        ]),
      )
      .mockReturnValueOnce(
        asStream([
          { type: 'text_delta', text: 'Hay datos.' },
          { type: 'turn_end', stopReason: 'end_turn' },
        ]),
      );

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ c: '50' }],
      rowCount: 1,
      durationMs: 12,
      truncated: false,
    });

    const events = await collect(service.streamAgent({ q: 'promedio' }));
    const normalizedSql =
      'SELECT COUNT(*) AS c FROM "Student" s JOIN "Enrollment" e ON e."studentId" = s.id';

    expect(events).toContainEqual({ type: 'tool_call', sql: normalizedSql });
    expect(executor.run).toHaveBeenCalledWith(normalizedSql);
  });

  it('si SQLCoder pre-genera SQL, lo ejecuta antes del primer turno del LLM', async () => {
    vi.mocked(sqlGen.generateIfAvailable).mockResolvedValueOnce(
      'SELECT COUNT(*) AS total FROM "Student"',
    );

    const callSnapshots: { messages: unknown[] }[] = [];
    mockStreamWithTools.mockImplementation((messages: unknown[]) => {
      callSnapshots.push({ messages: JSON.parse(JSON.stringify(messages)) });
      return asStream([
        { type: 'text_delta', text: 'Hay 50 estudiantes.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]);
    });

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ total: '50' }],
      rowCount: 1,
      durationMs: 10,
      truncated: false,
    });

    const events = await collect(
      service.streamAgent(
        { q: '¿Cuántos estudiantes hay?' },
        'tenant-demo',
        'private-mac',
      ),
    );

    expect(events).toEqual([
      { type: 'tool_call', sql: 'SELECT COUNT(*) AS total FROM "Student"' },
      {
        type: 'tool_result',
        rowCount: 1,
        durationMs: 10,
        preview: [{ total: '50' }],
        truncated: false,
      },
      { type: 'token', text: 'Hay 50 estudiantes.' },
      { type: 'done', turns: 1, truncated: false },
    ]);
    expect(executor.run).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS total FROM "Student"',
    );
    expect(mockStreamWithTools).toHaveBeenCalledOnce();

    const firstMessages = callSnapshots[0].messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(firstMessages).toHaveLength(4);
    expect(firstMessages[0].content).toEqual(
      expect.stringContaining('tool_result de `run_sql`'),
    );
    expect(firstMessages[2]).toMatchObject({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'sqlcoder_pre_run',
          name: 'run_sql',
          input: { sql: 'SELECT COUNT(*) AS total FROM "Student"' },
        },
      ],
    });
    expect(firstMessages[3]).toMatchObject({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'sqlcoder_pre_run',
          isError: false,
        },
      ],
    });

    const audit = mockAgentQueryCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      question: '¿Cuántos estudiantes hay?',
      sql: 'SELECT COUNT(*) AS total FROM "Student"',
      rowCount: 1,
      success: true,
      turns: 1,
      tenantId: 'tenant-demo',
    });
  });

  it('usa SQL canónico para preguntas sugeridas antes de llamar SQLCoder', async () => {
    mockStreamWithTools.mockReturnValueOnce(
      asStream([
        { type: 'text_delta', text: 'Hay 50 estudiantes.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]),
    );

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ total_estudiantes: '50' }],
      rowCount: 1,
      durationMs: 10,
      truncated: false,
    });

    const events = await collect(
      service.streamAgent(
        { q: '¿Cuántos estudiantes hay en total?' },
        'tenant-demo',
        'private-mac',
      ),
    );

    expect(sqlGen.generateIfAvailable).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      type: 'tool_call',
      sql: 'SELECT COUNT(*) AS total_estudiantes FROM "Student"',
    });
    expect(executor.run).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS total_estudiantes FROM "Student"',
    );
  });

  it('normaliza tablas académicas en minúscula antes de ejecutar SQL pre-generado', async () => {
    vi.mocked(sqlGen.generateIfAvailable).mockResolvedValueOnce(
      'SELECT COUNT(*) AS total FROM student',
    );

    mockStreamWithTools.mockReturnValueOnce(
      asStream([
        { type: 'text_delta', text: 'Hay 50 estudiantes.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]),
    );

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ total: '50' }],
      rowCount: 1,
      durationMs: 10,
      truncated: false,
    });

    const events = await collect(
      service.streamAgent(
        { q: '¿Cuántos estudiantes hay?' },
        'tenant-demo',
        'private-mac',
      ),
    );

    expect(events).toContainEqual({
      type: 'tool_call',
      sql: 'SELECT COUNT(*) AS total FROM "Student"',
    });
    expect(executor.run).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS total FROM "Student"',
    );

    const audit = mockAgentQueryCreate.mock.calls[0][0].data;
    expect(audit.sql).toBe('SELECT COUNT(*) AS total FROM "Student"');
  });

  it('normaliza fechas ISO usadas como term antes de ejecutar SQL pre-generado', async () => {
    vi.mocked(sqlGen.generateIfAvailable).mockResolvedValueOnce(
      'SELECT c.name, COUNT(e.id) AS enrollment_count FROM "Course" c JOIN "Enrollment" e ON c.id = e."courseId" WHERE e.term = \'2025-01-01\' GROUP BY c.name ORDER BY enrollment_count DESC LIMIT 1',
    );

    mockStreamWithTools.mockReturnValueOnce(
      asStream([
        { type: 'text_delta', text: 'La materia con más inscripciones es X.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]),
    );

    vi.mocked(executor.run).mockResolvedValueOnce({
      ok: true,
      rows: [{ name: 'Bases de Datos', enrollment_count: '72' }],
      rowCount: 1,
      durationMs: 10,
      truncated: false,
    });

    const events = await collect(
      service.streamAgent(
        { q: '¿Cuál es la materia con más inscripciones en 2025-1?' },
        'tenant-demo',
        'private-mac',
      ),
    );
    const normalizedSql =
      'SELECT c.name, COUNT(e.id) AS enrollment_count FROM "Course" c JOIN "Enrollment" e ON c.id = e."courseId" WHERE e.term = \'2025-1\' GROUP BY c.name ORDER BY enrollment_count DESC LIMIT 1';

    expect(events).toContainEqual({ type: 'tool_call', sql: normalizedSql });
    expect(executor.run).toHaveBeenCalledWith(normalizedSql);

    const audit = mockAgentQueryCreate.mock.calls[0][0].data;
    expect(audit.sql).toBe(normalizedSql);
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

  // ---------------------------------------------------------------------------
  // Audit log (AgentQuery)
  // ---------------------------------------------------------------------------

  describe('audit log', () => {
    it('persiste una entrada con success=true cuando el loop termina con end_turn', async () => {
      mockStreamWithTools
        .mockReturnValueOnce(
          asStream([
            {
              type: 'tool_use_complete',
              id: 'toolu_1',
              name: 'run_sql',
              input: { sql: 'SELECT COUNT(*) FROM "Student"' },
            },
            { type: 'turn_end', stopReason: 'tool_use' },
          ]),
        )
        .mockReturnValueOnce(
          asStream([
            { type: 'text_delta', text: 'Hay 50.' },
            { type: 'turn_end', stopReason: 'end_turn' },
          ]),
        );

      vi.mocked(executor.run).mockResolvedValueOnce({
        ok: true,
        rows: [{ count: 50 }],
        rowCount: 1,
        durationMs: 12,
        truncated: false,
      });

      await collect(service.streamAgent({ q: '¿Cuántos estudiantes hay?' }));

      expect(mockAgentQueryCreate).toHaveBeenCalledOnce();
      const audit = mockAgentQueryCreate.mock.calls[0][0].data;
      expect(audit).toMatchObject({
        question: '¿Cuántos estudiantes hay?',
        sql: 'SELECT COUNT(*) FROM "Student"',
        rowCount: 1,
        success: true,
        errorMessage: null,
        turns: 2,
      });
      expect(audit.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('persiste success=false con errorMessage cuando el LLM falla', async () => {
      mockStreamWithTools.mockImplementation(() => {
        throw new Error('LLM caído');
      });

      await collect(service.streamAgent({ q: 'algo' }));

      const audit = mockAgentQueryCreate.mock.calls[0][0].data;
      expect(audit).toMatchObject({
        question: 'algo',
        sql: null,
        rowCount: null,
        success: false,
        errorMessage: 'LLM caído',
        turns: 1,
      });
    });

    it('persiste success=false con mensaje de MAX_TURNS cuando se trunca', async () => {
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
        .mockReturnValueOnce(toolUseTurn());
      vi.mocked(executor.run).mockResolvedValue({
        ok: true,
        rows: [],
        rowCount: 0,
        durationMs: 1,
        truncated: false,
      });

      await collect(service.streamAgent({ q: 'infinite' }));

      const audit = mockAgentQueryCreate.mock.calls[0][0].data;
      expect(audit.success).toBe(false);
      expect(audit.errorMessage).toMatch(/MAX_TURNS/);
      expect(audit.turns).toBe(5);
    });

    it('si el insert del audit falla, NO rompe el stream del agente', async () => {
      mockStreamWithTools.mockReturnValueOnce(
        asStream([
          { type: 'text_delta', text: 'hola' },
          { type: 'turn_end', stopReason: 'end_turn' },
        ]),
      );
      mockAgentQueryCreate.mockRejectedValueOnce(new Error('DB caída'));

      // El stream debe completar sin re-throw, aunque el audit haya fallado.
      const events = await collect(service.streamAgent({ q: 'algo' }));
      expect(events).toContainEqual({ type: 'token', text: 'hola' });
      expect(events).toContainEqual({
        type: 'done',
        turns: 1,
        truncated: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findHistory
  // ---------------------------------------------------------------------------

  describe('findHistory()', () => {
    it('devuelve items paginados con createdAt como ISO string', async () => {
      mockAgentQueryFindMany.mockResolvedValue([
        {
          id: 'q1',
          question: '¿Cuántos?',
          sql: 'SELECT 1',
          rowCount: 1,
          durationMs: 200,
          success: true,
          errorMessage: null,
          turns: 2,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      mockAgentQueryCount.mockResolvedValue(1);

      const result = await service.findHistory({});

      expect(result).toEqual({
        items: [
          {
            id: 'q1',
            question: '¿Cuántos?',
            sql: 'SELECT 1',
            rowCount: 1,
            durationMs: 200,
            success: true,
            errorMessage: null,
            turns: 2,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });

      expect(mockAgentQueryFindMany.mock.calls[0][0]).toMatchObject({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('respeta limit/offset y devuelve total separado del length de items', async () => {
      mockAgentQueryFindMany.mockResolvedValue([]);
      mockAgentQueryCount.mockResolvedValue(99);

      const result = await service.findHistory({ limit: 5, offset: 90 });

      expect(result).toEqual({ items: [], total: 99, limit: 5, offset: 90 });
      expect(mockAgentQueryFindMany.mock.calls[0][0]).toMatchObject({
        skip: 90,
        take: 5,
      });
    });
  });
});
