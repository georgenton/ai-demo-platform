// -----------------------------------------------------------------------------
// LoansController — REST + SSE para el Demo 09.
//
// 4 endpoints, todos gated por @RequireDemo('loans'):
//   POST /api/v1/loans/chat        → SSE con la respuesta del bot.
//   GET  /api/v1/loans/:id         → snapshot completo del lead.
//   GET  /api/v1/loans             → lista para el kanban.
//   GET  /api/v1/loans/metrics     → conteos por etapa.
// -----------------------------------------------------------------------------

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { from, map, type Observable } from 'rxjs';

import type { ChatProvider } from '@org/llm-adapter';

import {
  CurrentLlmProvider,
  CurrentTenant,
} from '../auth/current-user.decorator.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

import {
  ChatLoanRequestDto,
  type LoanChatEvent,
  type LoanFunnelMetricsDto,
  type LoanLeadDto,
  type LoanLeadListItemDto,
} from './dto/loans.dto.js';
import { LoansService } from './loans.service.js';

@ApiTags('Loans (Demo 09)')
@Controller({ path: 'loans' })
@RequireDemo('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  // ---------------------------------------------------------------------------
  // POST /api/v1/loans/chat → SSE
  // ---------------------------------------------------------------------------

  @Post('chat')
  @Sse()
  @ApiOperation({
    summary: 'Chat con Coopi, el asistente del funnel de préstamos',
    description:
      'Recibe `leadId` (opcional — si vacío crea un lead nuevo) y `message`. ' +
      'Devuelve SSE con eventos: `token` (texto del bot), `tool` (resumen de tool call), ' +
      '`stage_changed` (cuando avanza el funnel), `error_event`, `done`.',
  })
  chat(
    @Body() dto: ChatLoanRequestDto,
    @CurrentTenant() tenantId: string,
    @CurrentLlmProvider() llmProvider: ChatProvider | undefined,
  ): Observable<MessageEvent> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return from(
      this.loans.chat(
        tenantId,
        { leadId: dto.leadId, message: dto.message },
        llmProvider,
      ),
    ).pipe(map((event) => this.toMessageEvent(event)));
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/loans/:id → snapshot completo del lead
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve el LoanLead completo + último análisis' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 404,
    description: 'Lead no existe o pertenece a otro tenant.',
  })
  findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LoanLeadDto> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.loans.findById(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/loans → lista para el kanban
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'Lista de leads del tenant ordenados por updatedAt desc',
    description:
      'Hasta 200 leads — para el demo sobra. Alimenta el kanban del oficial de crédito.',
  })
  list(@CurrentTenant() tenantId: string): Promise<LoanLeadListItemDto[]> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.loans.list(tenantId);
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/loans/metrics → conteos por etapa
  // ---------------------------------------------------------------------------

  @Get('funnel/metrics')
  @ApiOperation({
    summary: 'Conteos de leads por etapa + tasas de conversión',
    description:
      'Alimenta el componente FunnelMetrics de la vista oficial. Devuelve un map ' +
      '{ stage → cantidad } más totales `active` y `rejected`.',
  })
  metrics(@CurrentTenant() tenantId: string): Promise<LoanFunnelMetricsDto> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.loans.metrics(tenantId);
  }

  // ---------------------------------------------------------------------------
  // SSE serializer
  // ---------------------------------------------------------------------------

  private toMessageEvent(event: LoanChatEvent): MessageEvent {
    const { type, ...data } = event;
    return { type, data };
  }
}
