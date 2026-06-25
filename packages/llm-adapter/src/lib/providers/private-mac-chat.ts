import type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatRichMessage,
  ChatTool,
  ChatUsage,
  StreamWithUsage,
} from '../types.js';

import {
  messagesToOpenAI,
  parseOpenAIToolStream,
  toolsToOpenAI,
} from './openai-tool-stream.js';

type PrivateMacChatConfig = ChatConfig & {
  demoName?: string;
  timeoutMs?: number;
};

function estimateTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4));
}

function requestId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export class PrivateMacChatAdapter implements ChatAdapter {
  private readonly baseUrl: string;
  private readonly demoName: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: PrivateMacChatConfig) {
    if (!config.baseUrl) {
      throw new Error(
        'PRIVATE_LLM_BASE_URL/CHAT_BASE_URL is required for private-mac chat.',
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.demoName =
      config.demoName ?? process.env.PRIVATE_LLM_DEMO_NAME ?? 'demo-bank';
    this.timeoutMs =
      config.timeoutMs ?? Number(process.env.PRIVATE_LLM_TIMEOUT_MS ?? 120000);
  }

  async *completeStream(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await this.postChat(messages, true);
    yield* this.iterateSseText(response);
  }

  completeStreamWithUsage(messages: ChatMessage[]): StreamWithUsage {
    let resolveUsage!: (u: ChatUsage) => void;
    let rejectUsage!: (e: unknown) => void;
    const usage = new Promise<ChatUsage>((res, rej) => {
      resolveUsage = res;
      rejectUsage = rej;
    });

    const inputTokens = estimateTokens(
      messages.reduce((sum, message) => sum + message.content.length, 0),
    );

    const iterate = async function* (adapter: PrivateMacChatAdapter) {
      let outputChars = 0;
      try {
        for await (const token of adapter.completeStream(messages)) {
          outputChars += token.length;
          yield token;
        }
        resolveUsage({
          inputTokens,
          outputTokens: estimateTokens(outputChars),
        });
      } catch (error) {
        rejectUsage(error);
        throw error;
      }
    };

    return { stream: iterate(this), usage };
  }

  async *streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent> {
    const response = await this.postWithTools(messages, tools);
    yield* parseOpenAIToolStream(response);
  }

  /**
   * POST al endpoint OpenAI-compatible del gateway con `tools` incluidos y
   * `stream: true`. El gateway de Ollama/vLLM/NAI implementa la misma spec
   * (formato de tools de OpenAI + tool_calls en deltas).
   */
  private async postWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'x-demo-name': this.demoName,
          'x-request-id': `ai-demo-tools-${requestId()}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messagesToOpenAI(messages),
          tools: toolsToOpenAI(tools),
          stream: true,
        }),
      });
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Private Mac chat (tools) failed with HTTP ${response.status}: ${body}`,
        );
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async postChat(
    messages: ChatMessage[],
    stream: boolean,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'x-demo-name': this.demoName,
          'x-request-id': `ai-demo-${requestId()}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream,
        }),
      });
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Private Mac chat failed with HTTP ${response.status}: ${body}`,
        );
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async *iterateSseText(response: Response): AsyncIterable<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const line = event
          .split('\n')
          .find((item) => item.startsWith('data: '));
        if (!line) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') return;
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) yield delta;
      }
    }
  }
}
