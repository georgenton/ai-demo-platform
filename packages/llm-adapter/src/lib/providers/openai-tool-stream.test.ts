// -----------------------------------------------------------------------------
// Tests del parser de stream OpenAI-compatible con tools.
//
// Cubrimos:
//   - messagesToOpenAI: conversión de ChatRichMessage al shape OpenAI flat.
//   - toolsToOpenAI: conversión del array de tools.
//   - parseOpenAIToolStream:
//     - Text deltas → text_delta.
//     - Tool calls que se construyen progresivamente → tool_use_complete.
//     - finish_reason=stop → turn_end con end_turn.
//     - finish_reason=tool_calls → turn_end con tool_use.
//     - Args malformados → no rompe; emite input vacío.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  messagesToOpenAI,
  parseOpenAIToolStream,
  toolsToOpenAI,
} from './openai-tool-stream.js';
import type { AssistantStreamEvent, ChatRichMessage } from '../types.js';

/**
 * Crea un Response con un body que streamea las líneas SSE pasadas. Cada
 * elemento del array es un "evento" completo (será separado por \n\n).
 */
function fakeSseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(ev + '\n\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

async function collect(
  iter: AsyncIterable<AssistantStreamEvent>,
): Promise<AssistantStreamEvent[]> {
  const out: AssistantStreamEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

describe('messagesToOpenAI', () => {
  it('convierte system + user texto plano sin tocar', () => {
    const msgs: ChatRichMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hola' },
    ];
    expect(messagesToOpenAI(msgs)).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hola' },
    ]);
  });

  it('expande user con ToolResultBlock[] a varios role:tool', () => {
    const msgs: ChatRichMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 't1', content: '50' },
          {
            type: 'tool_result',
            toolUseId: 't2',
            content: 'boom',
            isError: true,
          },
        ],
      },
    ];
    expect(messagesToOpenAI(msgs)).toEqual([
      { role: 'tool', tool_call_id: 't1', content: '50' },
      { role: 'tool', tool_call_id: 't2', content: '[ERROR] boom' },
    ]);
  });

  it('serializa assistant con tool_use[] al formato tool_calls', () => {
    const msgs: ChatRichMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'pensando…' },
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'run_sql',
            input: { sql: 'SELECT 1' },
          },
        ],
      },
    ];
    expect(messagesToOpenAI(msgs)).toEqual([
      {
        role: 'assistant',
        content: 'pensando…',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'run_sql',
              arguments: JSON.stringify({ sql: 'SELECT 1' }),
            },
          },
        ],
      },
    ]);
  });

  it('manda content=null cuando assistant solo tiene tool_use (sin texto)', () => {
    const msgs: ChatRichMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c', name: 'n', input: {} }],
      },
    ];
    const out = messagesToOpenAI(msgs);
    expect(out[0].content).toBeNull();
  });
});

describe('toolsToOpenAI', () => {
  it('mapea ChatTool al shape { type:function, function:{...} }', () => {
    expect(
      toolsToOpenAI([
        {
          name: 'run_sql',
          description: 'Run SQL',
          inputSchema: {
            type: 'object',
            properties: { sql: { type: 'string' } },
            required: ['sql'],
          },
        },
      ]),
    ).toEqual([
      {
        type: 'function',
        function: {
          name: 'run_sql',
          description: 'Run SQL',
          parameters: {
            type: 'object',
            properties: { sql: { type: 'string' } },
            required: ['sql'],
          },
        },
      },
    ]);
  });
});

describe('parseOpenAIToolStream', () => {
  it('emite text_delta por cada delta de texto y turn_end al final', async () => {
    const events = [
      'data: {"choices":[{"delta":{"content":"Hola"},"index":0}]}',
      'data: {"choices":[{"delta":{"content":" mundo"},"index":0}]}',
      'data: {"choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}',
      'data: [DONE]',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    expect(result).toEqual([
      { type: 'text_delta', text: 'Hola' },
      { type: 'text_delta', text: ' mundo' },
      { type: 'turn_end', stopReason: 'end_turn' },
    ]);
  });

  it('acumula tool_calls fragmentados y emite tool_use_complete + turn_end', async () => {
    const events = [
      // arranque del tool: id + nombre + primer chunk de args.
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"run_sql","arguments":"{\\"sql\\":"}}]},"index":0}]}',
      // más args.
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"SELECT 1\\""}}]},"index":0}]}',
      // cierre de args.
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"}"}}]},"index":0}]}',
      // finish_reason=tool_calls.
      'data: {"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}]}',
      'data: [DONE]',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    expect(result).toEqual([
      {
        type: 'tool_use_complete',
        id: 'call_1',
        name: 'run_sql',
        input: { sql: 'SELECT 1' },
      },
      { type: 'turn_end', stopReason: 'tool_use' },
    ]);
  });

  it('soporta multiple tool_calls en paralelo (mismo turn)', async () => {
    const events = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","type":"function","function":{"name":"t1","arguments":"{}"}}]},"index":0}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","type":"function","function":{"name":"t2","arguments":"{}"}}]},"index":0}]}',
      'data: {"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}]}',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    expect(result).toEqual([
      { type: 'tool_use_complete', id: 'a', name: 't1', input: {} },
      { type: 'tool_use_complete', id: 'b', name: 't2', input: {} },
      { type: 'turn_end', stopReason: 'tool_use' },
    ]);
  });

  it('no rompe cuando los args son JSON malformado — emite input={}', async () => {
    const events = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"x","type":"function","function":{"name":"t","arguments":"not json"}}]},"index":0}]}',
      'data: {"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}]}',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    expect(result[0]).toEqual({
      type: 'tool_use_complete',
      id: 'x',
      name: 't',
      input: {},
    });
  });

  it('ignora líneas que no son data: y data: [DONE]', async () => {
    const events = [
      ': comentario SSE\ndata: {"choices":[{"delta":{"content":"hi"},"index":0}]}',
      'event: ping',
      'data: [DONE]',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    // text_delta y turn_end (sin finish explícito = 'other').
    expect(result[0]).toEqual({ type: 'text_delta', text: 'hi' });
    expect(result[result.length - 1].type).toBe('turn_end');
  });

  it('mapea finish_reason=length a max_tokens', async () => {
    const events = [
      'data: {"choices":[{"delta":{"content":"x"},"index":0}]}',
      'data: {"choices":[{"delta":{},"index":0,"finish_reason":"length"}]}',
    ];
    const result = await collect(
      parseOpenAIToolStream(fakeSseResponse(events)),
    );
    expect(result[result.length - 1]).toEqual({
      type: 'turn_end',
      stopReason: 'max_tokens',
    });
  });
});
