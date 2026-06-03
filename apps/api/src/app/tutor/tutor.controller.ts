// -----------------------------------------------------------------------------
// HTTP layer del Demo 05.
//
// Dos endpoints:
//   - POST /api/v1/tutor/chat   — SSE, streamea tokens + un evento usage al fin.
//   - GET  /api/v1/tutor/pricing — JSON con providers comparados + NAI on-prem.
//
// El cost engine NO se expone como endpoint; la cuenta es pure math y se
// hace en el frontend con `pricing` + las inputs editables del panel. Eso
// evita un round-trip por cada cambio del slider.
// -----------------------------------------------------------------------------

import {
  Body,
  Controller,
  Get,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { TutorChatRequestDto } from './dto/chat-request.dto.js';
import { TutorService } from './tutor.service.js';
import { NAI_ON_PREM, PROVIDERS } from './cost/pricing.constants.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

@ApiTags('Tutor (Demo 05)')
@Controller({ path: 'tutor' })
@RequireDemo('tutor')
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  /**
   * POST /api/v1/tutor/chat
   *
   * Body (JSON): TutorChatRequestDto.
   *
   * Devuelve un stream SSE. Cada `data:` es un JSON con `{ type, ... }`:
   *   { "type": "token", "text": "Hello" }
   *   { "type": "usage", "usage": { "inputTokens": 42, "outputTokens": 13 } }
   *
   * El frontend hace JSON.parse de cada evento y reacciona por `type`.
   * Cuando el iterable termina, NestJS cierra la conexión SSE.
   */
  @Post('chat')
  @Sse()
  @ApiOperation({
    summary: 'Chat conversacional del tutor con streaming SSE',
    description:
      'Streamea tokens del LLM como eventos type=token y emite un evento ' +
      'type=usage al cierre con el conteo de tokens facturables.',
  })
  chat(@Body() dto: TutorChatRequestDto): Observable<MessageEvent> {
    return from(this.tutorService.streamChat(dto)).pipe(
      map((evt) => ({ data: JSON.stringify(evt) })),
    );
  }

  /**
   * GET /api/v1/tutor/pricing
   *
   * Devuelve la tabla de pricing del cost calculator. El frontend la carga una
   * vez al montar la página y la usa para hacer las cuentas locales en el
   * panel de proyección.
   */
  @Get('pricing')
  @ApiOperation({
    summary: 'Pricing actual de proveedores LLM comparados en el demo',
    description:
      'USD/M tokens para Anthropic Sonnet + modelo "NAI on-prem" con $0 ' +
      'variable. Cada entrada incluye `capturedAt` y `sourceUrl` para que el ' +
      'cálculo sea defendible.',
  })
  pricing() {
    return {
      providers: PROVIDERS,
      naiOnPrem: NAI_ON_PREM,
    };
  }
}
