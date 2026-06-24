// -----------------------------------------------------------------------------
// PrivateOnpremChatAdapter — provider on-prem para servidor Linux del cliente
// (típicamente Ubuntu CPU con Ollama, ver ADR-0022).
//
// Diferencias con PrivateMacChatAdapter:
//   - Lee env vars con prefijo `ONPREM_LLM_*` en lugar de `PRIVATE_LLM_*`.
//   - Default `x-demo-name` = 'demo-onprem' (vs 'demo-bank').
//   - Mismo protocolo HTTP OpenAI-compatible (POST /v1/chat/completions).
//
// Por qué dos clases casi gemelas: separar `private-mac` (Mac dev local) de
// `private-onprem` (Ubuntu del cliente) habilita la historia comercial "mismo
// código, tres entornos". Una futura refactor puede fusionarlas detrás de un
// `PrivateLlmChatAdapter` parametrizado por prefix, pero no es objetivo de
// este PR.
// -----------------------------------------------------------------------------

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

type PrivateOnpremChatConfig = ChatConfig & {
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

export class PrivateOnpremChatAdapter implements ChatAdapter {
  private readonly baseUrl: string;
  private readonly demoName: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: PrivateOnpremChatConfig) {
    if (!config.baseUrl) {
      throw new Error(
        'ONPREM_LLM_BASE_URL/CHAT_BASE_URL is required for private-onprem chat.',
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.demoName =
      config.demoName ?? process.env.ONPREM_LLM_DEMO_NAME ?? 'demo-onprem';
    this.timeoutMs =
      config.timeoutMs ?? Number(process.env.ONPREM_LLM_TIMEOUT_MS ?? 120000);
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

    const iterate = async function* (adapter: PrivateOnpremChatAdapter) {
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

  // eslint-disable-next-line require-yield
  async *streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent> {
    throw new Error(
      `PrivateOnpremChatAdapter.streamWithTools no está implementado aún ` +
        `(recibí ${messages.length} mensajes y ${tools.length} tools).`,
    );
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
          `Private on-prem chat failed with HTTP ${response.status}: ${body}`,
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
