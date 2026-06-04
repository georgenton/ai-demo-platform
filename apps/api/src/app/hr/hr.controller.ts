// -----------------------------------------------------------------------------
// HTTP layer del Demo 07.
//
// Endpoints:
//   GET  /api/v1/hr/jobs                              — catálogo de roles
//   GET  /api/v1/hr/jobs/:id                          — detalle del rol
//   POST /api/v1/hr/interviews                        — crear entrevista + primera pregunta
//   GET  /api/v1/hr/interviews/:id/next-question      — siguiente pregunta o done
//   POST /api/v1/hr/interviews/:id/answer             — guardar respuesta
//   POST /api/v1/hr/interviews/:id/finalize  (SSE)    — scoring del LLM
//
// Gating:
//   - `@RequireDemo('interview')` a nivel de clase: el DemoAccessGuard rechaza
//     a tenants que no tengan el demo habilitado.
//   - Las Interview viven en el tenant del reclutador (NO en el compartido).
//     El service valida que cada operación pertenezca al tenant del usuario.
// -----------------------------------------------------------------------------

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CurrentTenant } from '../auth/current-user.decorator.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

import { AnswerQuestionDto } from './dto/answer-question.dto.js';
import { CreateInterviewDto } from './dto/create-interview.dto.js';
import type { HrEvent } from './hr-events.js';
import { HrService } from './hr.service.js';

@ApiTags('HR (Demo 07)')
@Controller({ path: 'hr' })
@RequireDemo('interview')
export class HrController {
  constructor(private readonly hr: HrService) {}

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------

  @Get('jobs')
  @ApiOperation({
    summary: 'Lista de roles disponibles para entrevista',
    description:
      'Trae todos los roles seedeados del tenant compartido "hr-shared" con metadata pública. ' +
      'No expone la rúbrica de las preguntas (eso es input al LLM, no contenido para el candidato).',
  })
  listJobs() {
    return this.hr.listJobs();
  }

  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Detalle del rol con cantidad de preguntas',
    description:
      'Devuelve dimensions + _count.questions. Las preguntas individuales se sirven una por una ' +
      'via /next-question — el candidato nunca ve la lista completa de antemano.',
  })
  getJob(@Param('id') id: string) {
    return this.hr.getJob(id);
  }

  // ---------------------------------------------------------------------------
  // Entrevistas
  // ---------------------------------------------------------------------------

  @Post('interviews')
  @ApiOperation({
    summary: 'Crear una entrevista nueva y obtener la primera pregunta',
    description:
      'Crea la Interview en el tenant del reclutador con status in_progress y devuelve interviewId ' +
      '+ la primera pregunta para que el frontend arranque la sesión sin un round-trip adicional.',
  })
  createInterview(
    @Body() dto: CreateInterviewDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.hr.createInterview(tenantId, dto);
  }

  @Get('interviews/:id/next-question')
  @ApiOperation({
    summary: 'Siguiente pregunta no respondida o marker done',
    description:
      'Devuelve { done: false, currentQuestion } si quedan preguntas, o { done: true } si el ' +
      'candidato ya respondió todas. La entrevista debe estar en status in_progress.',
  })
  getNextQuestion(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.hr.getNextQuestion(tenantId, id);
  }

  @Post('interviews/:id/answer')
  @ApiOperation({
    summary: 'Persiste la respuesta del candidato a una pregunta',
    description:
      'Upsert por (interviewId, questionId): si el candidato re-grabó antes de confirmar, ' +
      'pisamos el transcript anterior. Validamos que la pregunta pertenezca al rol de la entrevista.',
  })
  recordAnswer(
    @Param('id') id: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.hr.recordAnswer(tenantId, id, dto);
  }

  @Post('interviews/:id/finalize')
  @Sse()
  @ApiOperation({
    summary: 'Stream SSE del scoring final con tool calling',
    description:
      'El LLM evalúa la entrevista completa y emite eventos tipados: token, dimension_scored ' +
      '(uno por dimensión), final (resumen + recomendación), done. Persiste scoring + cierra la ' +
      'Interview como finalized (o abandoned si el LLM se cortó antes de la recomendación).',
  })
  finalize(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Observable<MessageEvent> {
    return from(this.hr.streamFinalize(tenantId, id)).pipe(
      map((event) => this.toMessageEvent(event)),
    );
  }

  // ---------------------------------------------------------------------------
  // SSE serializer
  // ---------------------------------------------------------------------------

  private toMessageEvent(event: HrEvent): MessageEvent {
    const { type, ...data } = event;
    return { type, data };
  }
}
