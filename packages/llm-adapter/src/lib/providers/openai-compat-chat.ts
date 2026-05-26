// -----------------------------------------------------------------------------
// OpenAICompatChatAdapter — implementación de ChatAdapter usando 'openai'.
//
// Sirve tanto para OpenAI nativo como para cualquier endpoint compatible con
// su API (NAI con NIM, vLLM, etc.) — la única diferencia es el `baseURL`.
// En nuestro proyecto este adapter se activa en producción contra NAI.
// -----------------------------------------------------------------------------

import OpenAI from 'openai';

import type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatRichMessage,
  ChatTool,
} from '../types.js';

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

  // eslint-disable-next-line require-yield
  async *streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent> {
    // Tool use con OpenAI/NAI requiere mapear `tool_calls` y `tool_role` al
    // shape de bloques que expone nuestra interface. Hoy Demo 04 corre solo
    // contra Anthropic; cuando entre NAI con NIM/openai-compat, agregamos
    // la traducción acá (similar a `completeStream` pero más larga).
    //
    // El error menciona los counts de inputs para que sea obvio (a) que el
    // adapter recibió la llamada y (b) qué quiso usar — útil al debuggear.
    throw new Error(
      `OpenAICompatChatAdapter.streamWithTools no está implementado aún ` +
        `(recibí ${messages.length} mensajes y ${tools.length} tools). ` +
        `Demo 04 hoy solo corre con CHAT_PROVIDER=anthropic. ` +
        `Cuando entre NAI / NIM con tool use, mapear \`tools\` y \`tool_calls\` ` +
        `desde el formato de OpenAI al shape de bloques del adapter.`,
    );
  }
}
