// HTTP layer del /api/v1/chat (SSE).
//
// Puente entre el service (que devuelve AsyncIterable<string>) y NestJS (que
// espera Observable<MessageEvent> para el decorador @Sse()).
//
// RxJS `from(asyncIterable)` hace el bridge: cada token yieldeado se emite
// como una `next` del Observable; cuando el iterable termina, completa.

import { Controller, Query, Sse, type MessageEvent } from '@nestjs/common';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ChatQueryDto } from './dto/chat.dto.js';
import { ChatService } from './chat.service.js';

@Controller({ path: 'chat' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * GET /api/v1/chat?q=...&demoId=...&topK=5
   *
   * Devuelve un stream SSE de tokens. Cada evento:
   *
   *   data: <texto del token>
   *
   * Cuando el LLM termina, el server cierra la conexión.
   *
   * Cliente típico (browser):
   *
   *   const es = new EventSource('/api/v1/chat?q=...&demoId=rag');
   *   es.onmessage = (e) => process.stdout.write(e.data);
   *   es.onerror = () => es.close();
   */
  @Sse()
  chat(@Query() query: ChatQueryDto): Observable<MessageEvent> {
    return from(this.chatService.streamChat(query)).pipe(
      map((token) => ({ data: token })),
    );
  }
}
