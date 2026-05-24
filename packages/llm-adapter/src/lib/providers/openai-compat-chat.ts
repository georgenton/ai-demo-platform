// -----------------------------------------------------------------------------
// OpenAICompatChatAdapter — implementación de ChatAdapter usando 'openai'.
//
// Sirve tanto para OpenAI nativo como para cualquier endpoint compatible con
// su API (NAI con NIM, vLLM, etc.) — la única diferencia es el `baseURL`.
// En nuestro proyecto este adapter se activa en producción contra NAI.
// -----------------------------------------------------------------------------

import OpenAI from 'openai';

import type { ChatAdapter, ChatConfig, ChatMessage } from '../types.js';

export class OpenAICompatChatAdapter implements ChatAdapter {
  private readonly client: OpenAI;

  constructor(private readonly config: ChatConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async *completeStream(messages: ChatMessage[]): AsyncIterable<string> {
    // OpenAI/NAI aceptan los 3 roles directo en el array, sin separar system.
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
