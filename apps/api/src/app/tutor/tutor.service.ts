// -----------------------------------------------------------------------------
// TutorService — orquestador del Demo 05.
//
// Recibe el historial + último mensaje del usuario + level + scenario, arma
// el array de mensajes para el LLM (system prompt vía persona/), llama al
// adapter con `completeStreamWithUsage` y produce un AsyncIterable de eventos
// tipados que el controller convierte a SSE.
//
// Eventos emitidos:
//   - { type: 'token', text }  — un trozo de la respuesta. Streaming.
//   - { type: 'usage', usage } — UN solo evento al cierre, con los tokens
//                                facturables. El frontend lo usa para sumar
//                                al contador del cost calculator.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { chat } from '@org/llm-adapter';
import type { ChatMessage, ChatProvider, ChatUsage } from '@org/llm-adapter';

import type { TutorChatRequestDto } from './dto/chat-request.dto.js';
import { buildTutorSystemPrompt } from './persona/tutor-prompts.js';

/**
 * Eventos del stream del tutor. Distintos `type` permiten al frontend
 * reaccionar diferente sin protocolo custom — todo viaja como JSON dentro
 * del SSE.
 */
export type TutorStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'usage'; usage: ChatUsage };

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  /**
   * Genera el stream de eventos para una request del tutor.
   *
   * Flujo:
   *   1) Compone los mensajes: system prompt + history + nuevo user message.
   *   2) Llama `chat.completeStreamWithUsage` → stream + usage promise.
   *   3) For-await del stream → emite cada token como evento.
   *   4) Cuando el stream cierra, espera la usage promise y emite UN evento
   *      'usage' con el conteo final.
   *
   * Si el LLM falla a mitad del stream, propagamos el error — el controller
   * SSE lo convierte en `error` event y el frontend muestra el mensaje.
   */
  async *streamChat(
    dto: TutorChatRequestDto,
    llmProvider?: ChatProvider,
  ): AsyncIterable<TutorStreamEvent> {
    const scenario = dto.scenario ?? 'general';
    const messages = this.buildMessages(dto, scenario);

    this.logger.log(
      `tutor chat → level=${dto.level} scenario=${scenario} history_turns=${dto.history.length} msg_len=${dto.message.length}`,
    );

    const { stream, usage } = chat.completeStreamWithUsage(messages, {
      provider: llmProvider,
    });

    for await (const token of stream) {
      yield { type: 'token', text: token };
    }

    const finalUsage = await usage;
    this.logger.log(
      `tutor chat done → input=${finalUsage.inputTokens} output=${finalUsage.outputTokens} tokens`,
    );
    yield { type: 'usage', usage: finalUsage };
  }

  /** Construye el array `ChatMessage[]` para mandar al adapter. */
  private buildMessages(
    dto: TutorChatRequestDto,
    scenario: NonNullable<TutorChatRequestDto['scenario']>,
  ): ChatMessage[] {
    const system: ChatMessage = {
      role: 'system',
      content: buildTutorSystemPrompt(dto.level, scenario),
    };
    const history: ChatMessage[] = dto.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    const user: ChatMessage = { role: 'user', content: dto.message };
    return [system, ...history, user];
  }
}
