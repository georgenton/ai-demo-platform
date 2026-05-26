// -----------------------------------------------------------------------------
// Tests de AnthropicChatAdapter.streamWithTools.
//
// Mock del SDK de Anthropic con vi.mock — interceptamos `messages.create`
// y devolvemos un AsyncIterable de eventos que controlamos. Así podemos
// probar:
//   - Un turn donde el LLM emite solo texto y `end_turn`.
//   - Un turn donde el LLM emite texto + tool_use (acumulado por chunks de
//     input_json_delta) y termina con `tool_use`.
//   - Que el system prompt se separa correctamente del array de mensajes.
//   - Que los tool_result del usuario se convierten al snake_case del SDK.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  // El SDK exporta default = Anthropic class. Nuestra impl hace `new Anthropic(...)`
  // y luego `client.messages.create(...)`. Simulamos eso.
  return {
    default: class MockAnthropic {
      messages = { create: mockMessagesCreate };
    },
  };
});

import { AnthropicChatAdapter } from './anthropic-chat.js';

import type {
  AssistantStreamEvent,
  ChatRichMessage,
  ChatTool,
} from '../types.js';

/** Convierte un array de eventos del SDK en un AsyncIterable, como lo expone el stream real. */
async function* eventsAsIterable(events: unknown[]): AsyncIterable<unknown> {
  for (const e of events) yield e;
}

/** Consume un AsyncIterable de events del adapter a un array (sync-friendly para asserts). */
async function collect(
  iter: AsyncIterable<AssistantStreamEvent>,
): Promise<AssistantStreamEvent[]> {
  const out: AssistantStreamEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

const SAMPLE_TOOL: ChatTool = {
  name: 'run_sql',
  description: 'Ejecuta una SELECT contra la base académica.',
  inputSchema: {
    type: 'object',
    properties: { sql: { type: 'string' } },
    required: ['sql'],
  },
};

describe('AnthropicChatAdapter.streamWithTools', () => {
  let adapter: AnthropicChatAdapter;

  beforeEach(() => {
    mockMessagesCreate.mockReset();
    adapter = new AnthropicChatAdapter({
      provider: 'anthropic',
      apiKey: 'sk-fake',
      model: 'claude-sonnet-4',
    });
  });

  it('emite text_delta por cada chunk de texto y turn_end con end_turn', async () => {
    mockMessagesCreate.mockResolvedValue(
      eventsAsIterable([
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hola' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: ' mundo' },
        },
        { type: 'content_block_stop', index: 0 },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: {},
        },
        { type: 'message_stop' },
      ]),
    );

    const events = await collect(
      adapter.streamWithTools(
        [
          { role: 'system', content: 'Sos un agente.' },
          { role: 'user', content: '¿Cuántos estudiantes hay?' },
        ],
        [SAMPLE_TOOL],
      ),
    );

    expect(events).toEqual([
      { type: 'text_delta', text: 'Hola' },
      { type: 'text_delta', text: ' mundo' },
      { type: 'turn_end', stopReason: 'end_turn' },
    ]);
  });

  it('acumula input_json_delta y emite tool_use_complete con input parseado', async () => {
    mockMessagesCreate.mockResolvedValue(
      eventsAsIterable([
        // Bloque 0: texto introductorio.
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Voy a consultar.' },
        },
        { type: 'content_block_stop', index: 0 },
        // Bloque 1: tool_use. El input llega en dos pedazos.
        {
          type: 'content_block_start',
          index: 1,
          content_block: {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'run_sql',
            input: {},
          },
        },
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: '{"sql":"SELE' },
        },
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: 'CT 1"}' },
        },
        { type: 'content_block_stop', index: 1 },
        {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
          usage: {},
        },
        { type: 'message_stop' },
      ]),
    );

    const events = await collect(
      adapter.streamWithTools(
        [{ role: 'user', content: '¿Cuántos estudiantes hay?' }],
        [SAMPLE_TOOL],
      ),
    );

    expect(events).toEqual([
      { type: 'text_delta', text: 'Voy a consultar.' },
      {
        type: 'tool_use_complete',
        id: 'toolu_123',
        name: 'run_sql',
        input: { sql: 'SELECT 1' },
      },
      { type: 'turn_end', stopReason: 'tool_use' },
    ]);
  });

  it('manda system separado y convierte tool_result al snake_case del SDK', async () => {
    mockMessagesCreate.mockResolvedValue(
      eventsAsIterable([
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: {},
        },
        { type: 'message_stop' },
      ]),
    );

    const messages: ChatRichMessage[] = [
      { role: 'system', content: 'Sos un agente SQL.' },
      { role: 'user', content: '¿Cuántos?' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Consulto.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'run_sql',
            input: { sql: 'SELECT COUNT(*) FROM Student' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'toolu_1',
            content: '{"rows":[{"count":50}]}',
          },
        ],
      },
    ];

    await collect(adapter.streamWithTools(messages, [SAMPLE_TOOL]));

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const call = mockMessagesCreate.mock.calls[0][0];
    // system fue separado.
    expect(call.system).toBe('Sos un agente SQL.');
    // messages NO incluye el system.
    expect(call.messages).toHaveLength(3);
    expect(call.messages[0]).toEqual({ role: 'user', content: '¿Cuántos?' });
    // tool_use del assistant se preserva.
    expect(call.messages[1].content[1]).toEqual({
      type: 'tool_use',
      id: 'toolu_1',
      name: 'run_sql',
      input: { sql: 'SELECT COUNT(*) FROM Student' },
    });
    // tool_result se convierte a snake_case.
    expect(call.messages[2].content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      content: '{"rows":[{"count":50}]}',
      is_error: undefined,
    });
    // tools van con input_schema (snake_case).
    expect(call.tools).toEqual([
      {
        name: 'run_sql',
        description: 'Ejecuta una SELECT contra la base académica.',
        input_schema: {
          type: 'object',
          properties: { sql: { type: 'string' } },
          required: ['sql'],
        },
      },
    ]);
  });

  it('mapea stop_reason desconocido a "other"', async () => {
    mockMessagesCreate.mockResolvedValue(
      eventsAsIterable([
        {
          type: 'message_delta',
          delta: { stop_reason: 'something_new' },
          usage: {},
        },
        { type: 'message_stop' },
      ]),
    );

    const events = await collect(
      adapter.streamWithTools([{ role: 'user', content: 'x' }], [SAMPLE_TOOL]),
    );

    expect(events).toEqual([{ type: 'turn_end', stopReason: 'other' }]);
  });
});
