// -----------------------------------------------------------------------------
// Tests del FakeChatAdapter. Cubrimos:
//   - completeStream: routing por keywords (matrícula, recalificación, IP,
//     comparator), emisión token-por-token, determinismo.
//   - streamWithTools: secuencia correcta de eventos en el loop multi-turn
//     del agente — primer turn emite tool_use con SQL, segundo turn emite
//     texto + turn_end.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { FakeChatAdapter } from './fake-chat.js';
import type {
  AssistantStreamEvent,
  ChatMessage,
  ChatRichMessage,
  ChatTool,
} from '../types.js';

const cfg = { provider: 'fake' as const, apiKey: 'x', model: 'x' };

/** Helper: consume el async iterable y devuelve el texto concatenado. */
async function collectText(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const tok of stream) out += tok;
  return out;
}

/** Helper: consume el async iterable y devuelve la lista de eventos. */
async function collectEvents(
  stream: AsyncIterable<AssistantStreamEvent>,
): Promise<AssistantStreamEvent[]> {
  const out: AssistantStreamEvent[] = [];
  for await (const e of stream) out.push(e);
  return out;
}

const RUN_SQL: ChatTool = {
  name: 'run_sql',
  description: 'execute sql',
  inputSchema: { type: 'object', properties: { sql: { type: 'string' } } },
};

describe('FakeChatAdapter.completeStream', () => {
  it('pregunta sobre matrícula → respuesta cita el manual de matrículas', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      { role: 'user', content: '¿Cuál es el horario de matrícula?' },
    ];
    const out = await collectText(adapter.completeStream(msgs));
    expect(out.toLowerCase()).toContain('manual de matrículas');
    expect(out).toMatch(/febrero|julio/);
  });

  it('pregunta sobre recalificación → cita el reglamento académico', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      { role: 'user', content: '¿Cómo se solicita una recalificación?' },
    ];
    const out = await collectText(adapter.completeStream(msgs));
    expect(out.toLowerCase()).toContain('reglamento académico');
  });

  it('pregunta sobre propiedad intelectual → cita la política', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      { role: 'user', content: '¿Qué dice sobre propiedad intelectual?' },
    ];
    const out = await collectText(adapter.completeStream(msgs));
    expect(out.toLowerCase()).toContain('propiedad intelectual');
  });

  it('prompt de comparador → tabla markdown con dimensiones', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      {
        role: 'user',
        content:
          'Compará estos contratos según las dimensiones: plazos de entrega, penalizaciones.',
      },
    ];
    const out = await collectText(adapter.completeStream(msgs));
    expect(out).toContain('| Dimensión |');
    expect(out).toContain('Plazos de entrega');
    expect(out).toContain('Penalizaciones');
  });

  it('streamea token por token (más de un yield)', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      { role: 'user', content: '¿Cuál es el horario de matrícula?' },
    ];
    const tokens: string[] = [];
    for await (const tok of adapter.completeStream(msgs)) tokens.push(tok);
    expect(tokens.length).toBeGreaterThan(5);
  });

  it('es determinístico (mismo prompt → misma salida)', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatMessage[] = [
      { role: 'user', content: '¿Cuál es el horario de matrícula?' },
    ];
    const a = await collectText(adapter.completeStream(msgs));
    const b = await collectText(adapter.completeStream(msgs));
    expect(a).toEqual(b);
  });
});

describe('FakeChatAdapter.streamWithTools — primer turn', () => {
  it('pregunta "total de estudiantes" → tool_use con COUNT(*) FROM Student', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatRichMessage[] = [
      { role: 'user', content: '¿Cuántos estudiantes hay en total?' },
    ];
    const events = await collectEvents(
      adapter.streamWithTools(msgs, [RUN_SQL]),
    );
    const toolUse = events.find((e) => e.type === 'tool_use_complete');
    expect(toolUse).toBeDefined();
    if (toolUse?.type === 'tool_use_complete') {
      expect(toolUse.name).toBe('run_sql');
      const input = toolUse.input as { sql: string };
      expect(input.sql).toMatch(/COUNT\(\*\)/i);
      expect(input.sql).toMatch(/"Student"/);
    }
    const end = events[events.length - 1];
    expect(end).toEqual({ type: 'turn_end', stopReason: 'tool_use' });
  });

  it('pregunta sobre reprobaron → SQL con WHERE score < 60', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatRichMessage[] = [
      {
        role: 'user',
        content: '¿Cuántos estudiantes reprobaron Cálculo II en 2025-1?',
      },
    ];
    const events = await collectEvents(
      adapter.streamWithTools(msgs, [RUN_SQL]),
    );
    const toolUse = events.find((e) => e.type === 'tool_use_complete');
    expect(toolUse?.type).toBe('tool_use_complete');
    if (toolUse?.type === 'tool_use_complete') {
      const input = toolUse.input as { sql: string };
      expect(input.sql).toMatch(/score/i);
      expect(input.sql).toMatch(/<\s*60/);
    }
  });
});

describe('FakeChatAdapter.streamWithTools — segundo turn (con tool_result)', () => {
  it('recibe tool_result con rows → emite texto final + stopReason end_turn', async () => {
    const adapter = new FakeChatAdapter(cfg);
    const msgs: ChatRichMessage[] = [
      { role: 'user', content: '¿Cuántos estudiantes hay en total?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'fake_1',
            name: 'run_sql',
            input: { sql: 'SELECT COUNT(*) AS total FROM "Student"' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'fake_1',
            content: JSON.stringify([{ total: 50 }]),
          },
        ],
      },
    ];
    const events = await collectEvents(
      adapter.streamWithTools(msgs, [RUN_SQL]),
    );
    const text = events
      .filter((e) => e.type === 'text_delta')
      .map((e) => (e as { type: 'text_delta'; text: string }).text)
      .join('');
    expect(text).toContain('50');
    expect(text.toLowerCase()).toContain('estudiantes');
    const end = events[events.length - 1];
    expect(end).toEqual({ type: 'turn_end', stopReason: 'end_turn' });
  });
});
