// -----------------------------------------------------------------------------
// AnthropicChatAdapter — implementación de ChatAdapter usando @anthropic-ai/sdk.
//
// Anthropic separa el "system prompt" del array de mensajes; OpenAI/NAI lo
// incluyen en messages. Acá hacemos la traducción: filtramos los mensajes con
// role='system', los concatenamos y los pasamos en el parámetro `system` de
// la API de Anthropic; el resto va como messages.
//
// Soporta dos modos:
//   - `completeStream`: chat simple, devuelve solo texto.
//   - `streamWithTools`: tool use (Demo 04). Mismo SSE-style stream pero
//     emite eventos tipados (texto, pedidos de tool, fin de turno).
// -----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

import type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatRichMessage,
  ChatTool,
  ChatUsage,
  StopReason,
  StreamWithUsage,
} from '../types.js';

/** Default conservador: el LLM no devuelve más de 4096 tokens por respuesta. */
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicChatAdapter implements ChatAdapter {
  private readonly client: Anthropic;

  constructor(private readonly config: ChatConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  // ---------------------------------------------------------------------------
  // completeStream — modo simple (Demo 01 / Demo 02)
  // ---------------------------------------------------------------------------

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
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // completeStreamWithUsage — chat + conteo de tokens (Demo 05)
  //
  // Igual que completeStream pero además parsea los tokens reales que reporta
  // Anthropic en el stream:
  //   - message_start → trae usage.input_tokens (final) en el primer evento.
  //   - message_delta → trae usage.output_tokens (cumulativo) en cada update.
  //   - message_stop → cierre, sin metadata adicional.
  //
  // Devolvemos un objeto con `stream` + `usage` (Promise). La promise resuelve
  // cuando el stream cierra de forma normal. Si el caller hace early-break y
  // no agota el stream, la promise queda pendiente — documentado en el
  // contrato de StreamWithUsage.
  // ---------------------------------------------------------------------------

  completeStreamWithUsage(messages: ChatMessage[]): StreamWithUsage {
    const systemContent = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Capturamos referencias locales — evita aliasing `this` dentro del
    // generator (el lint @typescript-eslint/no-this-alias no lo permite).
    const client = this.client;
    const model = this.config.model;

    let resolveUsage!: (u: ChatUsage) => void;
    let rejectUsage!: (e: unknown) => void;
    const usage = new Promise<ChatUsage>((res, rej) => {
      resolveUsage = res;
      rejectUsage = rej;
    });

    async function* iterate(): AsyncIterable<string> {
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const sdkStream = await client.messages.create({
          model,
          max_tokens: DEFAULT_MAX_TOKENS,
          system: systemContent || undefined,
          messages: conversation,
          stream: true,
        });

        for await (const event of sdkStream) {
          if (event.type === 'message_start') {
            // message_start.message.usage.input_tokens es el conteo final del
            // input (ya tokenizó el prompt completo). output_tokens viene en 1
            // (placeholder) — lo ignoramos y leemos los reales en los deltas.
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              yield event.delta.text;
            }
          } else if (event.type === 'message_delta') {
            // El usage de message_delta es cumulativo — el último gana.
            if (event.usage?.output_tokens != null) {
              outputTokens = event.usage.output_tokens;
            }
          }
        }
        resolveUsage({ inputTokens, outputTokens });
      } catch (err) {
        rejectUsage(err);
        throw err;
      }
    }

    return { stream: iterate(), usage };
  }

  // ---------------------------------------------------------------------------
  // streamWithTools — modo con tool use (Demo 04)
  // ---------------------------------------------------------------------------

  async *streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent> {
    // 1) Separamos system (Anthropic lo recibe aparte).
    const systemContent = messages
      .filter(
        (m): m is { role: 'system'; content: string } => m.role === 'system',
      )
      .map((m) => m.content)
      .join('\n\n');

    // 2) Convertimos el resto al shape de Anthropic. Los tool_result usan
    //    `tool_use_id` (snake_case) en el SDK; nosotros exponemos `toolUseId`.
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toAnthropicMessage(m));

    // 3) Convertimos los tools a la forma que espera el SDK.
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    // 4) Abrimos el stream.
    const stream = await this.client.messages.create({
      model: this.config.model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: systemContent || undefined,
      tools: anthropicTools,
      messages: conversation,
      stream: true,
    });

    // 5) Acumuladores. Por índice de bloque guardamos el JSON parcial de un
    //    tool_use (Anthropic lo manda en pedacitos via `input_json_delta`).
    //    Cuando el bloque cierra, parseamos y emitimos `tool_use_complete`.
    const toolUseBuffer = new Map<
      number,
      { id: string; name: string; jsonAcc: string }
    >();
    let stopReason: StopReason = 'other';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'tool_use') {
          toolUseBuffer.set(event.index, {
            id: block.id,
            name: block.name,
            jsonAcc: '',
          });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          const buf = toolUseBuffer.get(event.index);
          if (buf) buf.jsonAcc += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        const buf = toolUseBuffer.get(event.index);
        if (buf) {
          // Si el LLM no emitió ningún input_json_delta (tool sin args),
          // tratamos el input como objeto vacío para no fallar el parse.
          const input = buf.jsonAcc ? JSON.parse(buf.jsonAcc) : {};
          yield {
            type: 'tool_use_complete',
            id: buf.id,
            name: buf.name,
            input,
          };
          toolUseBuffer.delete(event.index);
        }
      } else if (event.type === 'message_delta') {
        // El stop_reason canónico del turn llega acá.
        if (event.delta.stop_reason) {
          stopReason = this.mapStopReason(event.delta.stop_reason);
        }
      }
    }

    yield { type: 'turn_end', stopReason };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /** Mapea un ChatRichMessage al shape exacto que espera el SDK. */
  private toAnthropicMessage(message: ChatRichMessage): Anthropic.MessageParam {
    if (message.role === 'system') {
      // Defensa: ya filtramos system arriba; este branch es por exhaustiveness.
      throw new Error('system message should not reach toAnthropicMessage');
    }

    if (typeof message.content === 'string') {
      return { role: message.role, content: message.content };
    }

    // Array de bloques. Convertimos cada uno al snake_case que espera el SDK.
    const contentBlocks = message.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      // tool_result
      return {
        type: 'tool_result' as const,
        tool_use_id: block.toolUseId,
        content: block.content,
        is_error: block.isError,
      };
    });

    return {
      role: message.role,
      content: contentBlocks,
    } as Anthropic.MessageParam;
  }

  /** Mapea el stop_reason crudo del SDK al union tipado del adapter. */
  private mapStopReason(raw: string): StopReason {
    switch (raw) {
      case 'end_turn':
      case 'tool_use':
      case 'max_tokens':
      case 'stop_sequence':
        return raw;
      default:
        return 'other';
    }
  }
}
