// -----------------------------------------------------------------------------
// HTTP layer del Demo 06.
//
// Endpoints:
//   GET  /api/v1/clinical/patients               — lista paciente (con search)
//   GET  /api/v1/clinical/patients/:id           — detalle + últimas consultas
//   GET  /api/v1/clinical/protocols              — lista de protocolos
//   POST /api/v1/clinical/analyze                — análisis SSE con tool calling
//
// Gating:
//   - `@RequireDemo('clinical')` a nivel de clase: el DemoAccessGuard rechaza
//     a tenants que no tengan el demo habilitado (industria != salud).
//   - El service además resuelve internamente el tenant de datos contra el
//     que consultar (hoy: tenant compartido `clinical-shared`).
//
// SSE de /analyze:
//   Idéntico al patrón de AgentController — convertimos cada ClinicalEvent en
//   un MessageEvent { type, data } donde `data` es el payload sin `type`. El
//   frontend hace `es.addEventListener(<type>, ...)`.
// -----------------------------------------------------------------------------

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CurrentTenant } from '../auth/current-user.decorator.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

import type { ClinicalEvent } from './clinical-events.js';
import { ClinicalService } from './clinical.service.js';
import { AnalyzeRequestDto } from './dto/analyze.request.dto.js';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto.js';
import { ListProtocolsQueryDto } from './dto/list-protocols.query.dto.js';

@ApiTags('Clinical (Demo 06)')
@Controller({ path: 'clinical' })
@RequireDemo('clinical')
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  /**
   * GET /api/v1/clinical/patients?search=...&limit=...
   *
   * Devuelve `{ items: Patient[], total: number }`. Cada paciente trae lo
   * mínimo para el panel izquierdo: id, nombre, edad, género, condiciones
   * crónicas (para mostrar como chips).
   */
  @Get('patients')
  @ApiOperation({
    summary: 'Lista de pacientes con búsqueda opcional',
    description:
      'Resuelve el tenant de datos según la industria del usuario. Hoy todos ' +
      'los usuarios de industria salud comparten el dataset sintético del demo.',
  })
  listPatients(
    @Query() dto: ListPatientsQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.clinicalService.listPatients(tenantId, dto);
  }

  /**
   * GET /api/v1/clinical/patients/:id
   *
   * Detalle completo del paciente + las últimas 10 consultas (DESC por fecha).
   * 404 si no existe en el tenant resuelto.
   */
  @Get('patients/:id')
  @ApiOperation({
    summary: 'Detalle del paciente con historia clínica reciente',
    description:
      'Devuelve el paciente con sus últimas 10 consultas (orden DESC por ' +
      'fecha). 404 si el id no pertenece al tenant resuelto.',
  })
  getPatient(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.clinicalService.getPatient(tenantId, id);
  }

  /**
   * GET /api/v1/clinical/protocols?category=...
   *
   * Catálogo de protocolos. Si `category` viene, filtra; si no, devuelve todos
   * y el frontend los agrupa por categoría en la vista de "biblioteca".
   */
  @Get('protocols')
  @ApiOperation({
    summary: 'Lista de protocolos clínicos (filtrable por categoría)',
    description:
      'Devuelve markdown crudo en `content`; el frontend renderiza con su ' +
      'componente de markdown estándar.',
  })
  listProtocols(
    @Query() dto: ListProtocolsQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.clinicalService.listProtocols(tenantId, dto);
  }

  /**
   * POST /api/v1/clinical/analyze
   *
   * Body (JSON): AnalyzeRequestDto.
   *
   * SSE stream con eventos tipados:
   *   event: token        → texto incremental del LLM
   *   event: tool_call    → el LLM pidió chequear interacciones
   *   event: tool_result  → resultado del chequeo
   *   event: done         → cierre normal
   *   event: error_event  → algo se rompió fatal (LLM caído, etc.)
   *
   * Errores PREVIOS al stream (paciente no existe, tenant inválido) salen
   * como HTTP normal (404/403). Errores DURANTE el stream salen como
   * `event: error_event`.
   */
  @Post('analyze')
  @Sse()
  @ApiOperation({
    summary: 'Análisis SSE del caso clínico con tool calling',
    description:
      'Carga al paciente con su historia (últimas 5 consultas) y arma el ' +
      'prompt. El LLM puede invocar `check_drug_interactions` para chequear ' +
      'riesgos antes de sugerir tratamientos. Stream de eventos tipados.',
  })
  analyze(
    @Body() dto: AnalyzeRequestDto,
    @CurrentTenant() tenantId: string,
  ): Observable<MessageEvent> {
    return from(this.clinicalService.streamAnalyze(dto, tenantId)).pipe(
      map((event) => this.toMessageEvent(event)),
    );
  }

  /** Convierte un ClinicalEvent (union) en MessageEvent SSE de NestJS. */
  private toMessageEvent(event: ClinicalEvent): MessageEvent {
    const { type, ...data } = event;
    return { type, data };
  }
}
