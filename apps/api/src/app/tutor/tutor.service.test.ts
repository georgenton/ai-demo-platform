// -----------------------------------------------------------------------------
// Tests del TutorService.
//
// El service depende del singleton `chat` exportado por @org/llm-adapter.
// Vitest no nos deja inyectarlo limpio sin un container DI, así que mockeamos
// el módulo entero con vi.mock — el adapter se reemplaza por uno fake bajo
// nuestro control que emite tokens y resuelve usage con valores conocidos.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage, StreamWithUsage } from '@org/llm-adapter';

import type { TutorChatRequestDto } from './dto/chat-request.dto.js';
import { TutorService, type TutorStreamEvent } from './tutor.service.js';

// El mock factory tiene que ser un objeto literal — no podemos referenciar
// variables externas porque vi.mock se hoistea por encima del módulo. Por
// eso guardamos el estado mutable en vars y exponemos un setter del mock.
const mockState = {
  capturedMessages: [] as ChatMessage[],
  tokensToYield: ['Hello', ' there!'] as string[],
  usageToReport: { inputTokens: 42, outputTokens: 13 },
};

vi.mock('@org/llm-adapter', () => ({
  chat: {
    completeStreamWithUsage(messages: ChatMessage[]): StreamWithUsage {
      mockState.capturedMessages = messages;
      const tokens = mockState.tokensToYield;
      const usage = mockState.usageToReport;
      async function* iterate(): AsyncIterable<string> {
        for (const t of tokens) yield t;
      }
      return {
        stream: iterate(),
        usage: Promise.resolve(usage),
      };
    },
  },
}));

async function collectEvents(
  iter: AsyncIterable<TutorStreamEvent>,
): Promise<TutorStreamEvent[]> {
  const out: TutorStreamEvent[] = [];
  for await (const evt of iter) out.push(evt);
  return out;
}

describe('TutorService.streamChat', () => {
  let service: TutorService;

  beforeEach(() => {
    service = new TutorService();
    mockState.capturedMessages = [];
    mockState.tokensToYield = ['Hello', ' there!'];
    mockState.usageToReport = { inputTokens: 42, outputTokens: 13 };
  });

  it('emite un evento por token + un evento usage al final', async () => {
    const dto: TutorChatRequestDto = {
      history: [],
      message: 'Hi!',
      level: 'B1',
    };

    const events = await collectEvents(service.streamChat(dto));

    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' there!' },
      { type: 'usage', usage: { inputTokens: 42, outputTokens: 13 } },
    ]);
  });

  it('arma el system prompt con level y scenario', async () => {
    const dto: TutorChatRequestDto = {
      history: [],
      message: 'Hi',
      level: 'A2',
      scenario: 'cafe',
    };

    await collectEvents(service.streamChat(dto));

    expect(mockState.capturedMessages[0].role).toBe('system');
    expect(mockState.capturedMessages[0].content).toMatch(/A2/);
    expect(mockState.capturedMessages[0].content.toLowerCase()).toContain(
      'barista',
    );
  });

  it('default scenario = general cuando no se pasa', async () => {
    const dto: TutorChatRequestDto = {
      history: [],
      message: 'Hi',
      level: 'B1',
    };

    await collectEvents(service.streamChat(dto));

    expect(mockState.capturedMessages[0].content.toLowerCase()).toContain(
      'conversation partner',
    );
  });

  it('preserva el historial entre system y el último user', async () => {
    const dto: TutorChatRequestDto = {
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! How are you?' },
      ],
      message: 'I am fine.',
      level: 'B1',
    };

    await collectEvents(service.streamChat(dto));

    // [system, user(hello), assistant(hi), user(i am fine)]
    expect(mockState.capturedMessages).toHaveLength(4);
    expect(mockState.capturedMessages[1]).toEqual({
      role: 'user',
      content: 'Hello',
    });
    expect(mockState.capturedMessages[3]).toEqual({
      role: 'user',
      content: 'I am fine.',
    });
  });
});
