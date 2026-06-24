// -----------------------------------------------------------------------------
// BiController — endpoint REST + SSE para el Demo 10.
//
// Un solo endpoint:
//   POST /api/v1/bi/chat   →  SSE con respuesta del LLM + SQL + rows + chart.
//
// Gated por @RequireDemo('bi'). El tenant del JWT se inyecta forzado a
// nivel de SQL en sql-safety.
// -----------------------------------------------------------------------------

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, map, type Observable } from 'rxjs';

import type { ChatProvider } from '@org/llm-adapter';

import {
  CurrentLlmProvider,
  CurrentTenant,
} from '../auth/current-user.decorator.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

import { BiService } from './bi.service.js';
import { BiChatRequestDto, type BiChatEvent } from './dto/bi.dto.js';

@ApiTags('BI (Demo 10)')
@Controller({ path: 'bi' })
@RequireDemo('bi')
export class BiController {
  constructor(private readonly bi: BiService) {}

  @Post('chat')
  @Sse()
  @ApiOperation({
    summary: 'Chat con Coopi Analytics sobre los indicadores del warehouse',
    description:
      'Recibe pregunta en español y devuelve SSE con eventos: token (texto), sql (SQL ejecutado), ' +
      'rows (resultados), chart (spec del gráfico), error_event, done.',
  })
  chat(
    @Body() dto: BiChatRequestDto,
    @CurrentTenant() tenantId: string,
    @CurrentLlmProvider() llmProvider: ChatProvider | undefined,
  ): Observable<MessageEvent> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return from(
      this.bi.chat(
        tenantId,
        { conversationId: dto.conversationId, message: dto.message },
        llmProvider,
      ),
    ).pipe(map((event) => this.toMessageEvent(event)));
  }

  private toMessageEvent(event: BiChatEvent): MessageEvent {
    const { type, ...data } = event;
    return { type, data };
  }
}
