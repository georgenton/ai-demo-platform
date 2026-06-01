// HTTP layer del /api/v1/chat (SSE).
//
// Puente entre el service (que devuelve AsyncIterable<string>) y NestJS (que
// espera Observable<MessageEvent> para el decorador @Sse()).
//
// RxJS `from(asyncIterable)` hace el bridge: cada token yieldeado se emite
// como una `next` del Observable; cuando el iterable termina, completa.

import { Controller, Query, Sse, type MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ChatQueryDto } from './dto/chat.dto.js';
import { ChatService } from './chat.service.js';
import { CurrentTenant } from '../auth/current-user.decorator.js';

@ApiTags('Chat (Demo 01)')
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
  @ApiOperation({
    summary:
      'Chat con streaming SSE (token por token) sobre los documentos indexados',
    description:
      'Embebe la pregunta, recupera los topK chunks más cercanos por similitud coseno (pgvector) y stremea la respuesta del LLM. La respuesta es text/event-stream — usar EventSource desde el browser.',
  })
  chat(
    @Query() query: ChatQueryDto,
    @CurrentTenant() tenantId: string,
  ): Observable<MessageEvent> {
    return from(this.chatService.streamChat(query, tenantId)).pipe(
      map((token) => ({ data: token })),
    );
  }
}
