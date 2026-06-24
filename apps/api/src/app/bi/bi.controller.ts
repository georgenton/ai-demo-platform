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
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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

import { BiDashboardService } from './dashboard.service.js';
import { BiService } from './bi.service.js';
import { BiChatRequestDto, type BiChatEvent } from './dto/bi.dto.js';
import {
  type BiDashboardItemDto,
  type BiDashboardItemExecuteResult,
  CreateDashboardItemDto,
  UpdateDashboardItemDto,
} from './dto/dashboard.dto.js';

@ApiTags('BI (Demo 10)')
@Controller({ path: 'bi' })
@RequireDemo('bi')
export class BiController {
  constructor(
    private readonly bi: BiService,
    private readonly dashboard: BiDashboardService,
  ) {}

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

  // ---------------------------------------------------------------------------
  // Dashboard guardado
  // ---------------------------------------------------------------------------

  @Get('dashboard')
  @ApiOperation({
    summary: 'Lista los items del dashboard guardado del tenant',
  })
  listDashboard(
    @CurrentTenant() tenantId: string,
  ): Promise<BiDashboardItemDto[]> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.dashboard.list(tenantId);
  }

  @Post('dashboard')
  @ApiOperation({
    summary: 'Guarda un chart al dashboard del tenant',
    description:
      'Recibe título + pregunta original + SQL sanitizado + spec del chart. El SQL se re-valida con sql-safety antes de persistir.',
  })
  createDashboardItem(
    @Body() body: CreateDashboardItemDto,
    @CurrentTenant() tenantId: string,
  ): Promise<BiDashboardItemDto> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.dashboard.create(tenantId, body);
  }

  @Patch('dashboard/:id')
  @ApiOperation({ summary: 'Renombra o reordena un item del dashboard' })
  updateDashboardItem(
    @Param('id') id: string,
    @Body() body: UpdateDashboardItemDto,
    @CurrentTenant() tenantId: string,
  ): Promise<BiDashboardItemDto> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.dashboard.update(tenantId, id, body);
  }

  @Delete('dashboard/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra un item del dashboard' })
  async deleteDashboardItem(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    await this.dashboard.remove(tenantId, id);
  }

  @Post('dashboard/:id/execute')
  @ApiOperation({
    summary: 'Re-ejecuta el SQL guardado del item y devuelve filas frescas',
  })
  executeDashboardItem(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BiDashboardItemExecuteResult> {
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.dashboard.execute(tenantId, id);
  }
}
