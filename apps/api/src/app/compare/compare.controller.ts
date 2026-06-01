// HTTP layer del POST /api/v1/compare (SSE).
//
// Mismo patrón que ChatController: el service devuelve AsyncIterable<string>,
// RxJS `from(asyncIterable)` lo convierte a Observable, y `@Sse()` lo emite
// como eventos. Cada token se envía como `data: <token>` y la conexión se
// cierra cuando el iterable termina.

import { Body, Controller, Post, Sse, type MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CompareService } from './compare.service.js';
import { CompareRequestDto } from './dto/compare.dto.js';
import { CurrentTenant } from '../auth/current-user.decorator.js';

@ApiTags('Compare (Demo 02)')
@Controller({ path: 'compare' })
export class CompareController {
  constructor(private readonly compareService: CompareService) {}

  /**
   * POST /api/v1/compare
   *
   * Body (JSON):
   *   { documentIds: string[2..5], dimensions: string[1..10], demoId?: string }
   *
   * Devuelve un stream SSE con el análisis comparativo del LLM. Cuando termina,
   * el server cierra la conexión.
   *
   * Por qué POST y no GET (como /chat): el body es estructurado (arrays con
   * validación), lo cual fuerza JSON, no query string. Aunque @Sse() suele
   * verse con GET, NestJS soporta sin problema combinarlo con @Post() —
   * el método HTTP no afecta la semántica del stream.
   */
  @Post()
  @Sse()
  @ApiOperation({
    summary: 'Comparador de documentos con SSE streaming',
    description:
      'Recibe 2–5 documentIds + 1–10 dimensiones; recupera el contenido, arma prompt comparativo y stremea el análisis. Response es text/event-stream.',
  })
  compare(
    @Body() dto: CompareRequestDto,
    @CurrentTenant() tenantId: string,
  ): Observable<MessageEvent> {
    return from(this.compareService.streamCompare(dto, tenantId)).pipe(
      map((token) => ({ data: token })),
    );
  }
}
