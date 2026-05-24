// -----------------------------------------------------------------------------
// AnthropicChatAdapter — implementación de ChatAdapter usando @anthropic-ai/sdk.
//
// Anthropic separa el "system prompt" del array de mensajes; OpenAI/NAI lo
// incluyen en messages. Acá hacemos la traducción: filtramos los mensajes con
// role='system', los concatenamos y los pasamos en el parámetro `system` de
// la API de Anthropic; el resto va como messages.
// -----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

import type { ChatAdapter, ChatConfig, ChatMessage } from '../types.js';

/** Default conservador: el LLM no devuelve más de 4096 tokens por respuesta. */
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicChatAdapter implements ChatAdapter {
  private readonly client: Anthropic;

  constructor(private readonly config: ChatConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async *completeStream(messages: ChatMessage[]): AsyncIterable<string> {
    // 1) Separamos system (Anthropic lo recibe aparte) del resto.
    const systemContent = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        // Después del filter, m.role solo puede ser 'user' | 'assistant',
        // pero TS no narra el tipo desde filter(); el `as` es necesario.
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 2) Abrimos el stream. Con `stream: true`, `messages.create(...)` devuelve
    //    una iterable async de eventos crudos (message_start, content_block_*,
    //    message_delta, message_stop). Nos interesan solo los deltas de texto.
    const stream = await this.client.messages.create({
      model: this.config.model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: systemContent || undefined,
      messages: conversation,
      stream: true,
    });

    // 3) Filtramos los eventos al tipo que nos importa: 'content_block_delta'
    //    con `delta.type === 'text_delta'`. Cada uno trae un trozo de texto.
    //    (Otros tipos de delta — input_json_delta para tool use, etc. — los
    //    manejamos cuando los necesitemos.)
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
