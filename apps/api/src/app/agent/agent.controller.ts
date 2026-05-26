// HTTP layer del POST /api/v1/agent (SSE con eventos tipados).
//
// A diferencia del chat (Demo 01) y compare (Demo 02) que stremean solo
// tokens crudos, este endpoint emite eventos tipados — el cliente recibe
// `event: token`, `event: tool_call`, `event: tool_result`, etc., cada uno
// con su payload JSON. La UI puede armar una visualización rica del
// "razonamiento" del agente (SQL ejecutada, resultados, respuesta final).

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { AgentEvent } from './agent-events.js';
import { AgentService } from './agent.service.js';
import {
  AgentHistoryQueryDto,
  type AgentHistoryResponse,
} from './dto/agent-history.dto.js';
import { AgentQueryDto } from './dto/agent-query.dto.js';

@Controller({ path: 'agent' })
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * POST /api/v1/agent
   *
   * Body (JSON): { q: string, demoId?: string }
   *
   * Devuelve un stream SSE con eventos tipados. Cada AgentEvent se serializa
   * como `event: <type>\ndata: <JSON payload sin 'type'>`. El cliente con
   * EventSource hace `es.addEventListener('token', ...)`, etc.
   *
   * Cuando el agente termina o falla, el server cierra la conexión.
   */
  @Post()
  @Sse()
  agent(@Body() dto: AgentQueryDto): Observable<MessageEvent> {
    return from(this.agentService.streamAgent(dto)).pipe(
      map((event) => this.toMessageEvent(event)),
    );
  }

  /**
   * GET /api/v1/agent/history
   *
   * Historial paginado de queries del agente, más recientes primero. Cada
   * entrada incluye la pregunta, la SQL final, el resultado y un flag de
   * éxito. Best-effort: si una request del agente se cayó por desconexión
   * del cliente, puede no estar en este log.
   */
  @Get('history')
  history(@Query() query: AgentHistoryQueryDto): Promise<AgentHistoryResponse> {
    return this.agentService.findHistory(query);
  }

  /**
   * Convierte un AgentEvent (discriminated union) en un MessageEvent SSE.
   * Sacamos `type` del payload porque va como el campo SSE `event:`.
   */
  private toMessageEvent(event: AgentEvent): MessageEvent {
    const { type, ...data } = event;
    return { type, data };
  }
}
