// -----------------------------------------------------------------------------
// LoansService — orquestador del Demo 09 (ADR-0020, sub-PR 2).
//
// Una sola responsabilidad pública: `chat()` — recibe un mensaje del socio,
// loopea con el LLM hasta que el modelo termine el turn (sin más tool calls),
// y emite eventos SSE (token, tool, stage_changed, error_event, done).
//
// El loop es idéntico al de HrService:
//   1. Cargar el lead (o crear uno nuevo si no se pasó leadId).
//   2. Rehidratar la conversación (mensajes previos del lead).
//   3. Anexar el mensaje del socio.
//   4. Loop while turns < MAX_TURNS:
//        a. Llamar chat.streamWithTools con los 5 tools.
//        b. Por cada event:
//             - text_delta → emit token + acumular en assistantBlocks.
//             - tool_use_complete → ejecutar la tool, persistir resultado.
//             - turn_end → ver stopReason.
//        c. Si stopReason === 'tool_use', re-loopear con los tool_results.
//        d. Sino, salir.
//   5. Persistir mensaje final + emit done.
// -----------------------------------------------------------------------------

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { prisma } from '@org/db';
import type { LoanLead, LoanStage } from '@org/db';
import type {
  ChatRichMessage,
  ChatProvider,
  TextBlock,
  ToolUseBlock,
} from '@org/llm-adapter';
import { chat } from '@org/llm-adapter';

import type {
  CoreBankingAdapter,
  CreditHistory,
  MemberInfo,
} from '@org/core-banking-adapter';

import type {
  EligibilityResult,
  LoanChatEvent,
  LoanLeadDto,
  LoanLeadListItemDto,
  LoanFunnelMetricsDto,
} from './dto/loans.dto.js';
import { buildLoansSystemPrompt } from './prompts.js';
import {
  LOAN_TOOLS,
  evaluateEligibility,
  parseCalculateEligibilityInput,
  parseConsultCoreBankingInput,
  parseMoveToStageInput,
  parseRegisterLeadInput,
  parseRequestDocumentInput,
  validateStageTransition,
  type LeadStageSnapshot,
} from './tools/index.js';

/** Token DI para el adapter de core bancario. */
export const CORE_BANKING = Symbol('CoreBankingAdapter');

/** Tope de turns conversacionales en un solo `chat()` call. Evita loops infinitos. */
const MAX_TURNS = 8;

/** Resultado de una ejecución de tool — lo que el service emite y persiste. */
interface ToolExecution {
  toolUseId: string;
  toolResult: { content: string; isError: boolean };
  event: LoanChatEvent | null;
  /** Actualizaciones a aplicar al lead después de este turn. */
  leadUpdates: Record<string, unknown>;
  /** Si la tool movió la etapa, snapshot para escribir en LoanStageHistory. */
  stageTransition: {
    from: LoanStage;
    to: LoanStage;
    reason: string;
  } | null;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @Inject(CORE_BANKING) private readonly core: CoreBankingAdapter,
  ) {}

  // -------------------------------------------------------------------------
  // Endpoints públicos
  // -------------------------------------------------------------------------

  /**
   * Loop conversacional. Es un async generator que emite eventos LoanChatEvent.
   * El controller lo conecta a SSE.
   */
  async *chat(
    tenantId: string,
    input: { leadId?: string; message: string },
    llmProvider?: ChatProvider,
  ): AsyncGenerator<LoanChatEvent> {
    const lead = input.leadId
      ? await this.loadLeadOrThrow(tenantId, input.leadId)
      : await this.createBlankLead(tenantId);

    this.logger.log(
      `chat → lead=${lead.id}, stage=${lead.currentStage}, provider=${llmProvider ?? 'env default'}`,
    );

    // Persistir el mensaje del socio si vino con texto.
    if (input.message.trim().length > 0) {
      await prisma.loanConversation.create({
        data: {
          leadId: lead.id,
          role: 'user',
          content: input.message,
        },
      });
    }

    // Rehidratar histórico.
    const history = await this.loadConversationHistory(lead.id);
    const messages: ChatRichMessage[] = [
      { role: 'system', content: buildLoansSystemPrompt(lead) },
      ...history,
      ...(input.message.trim().length > 0
        ? [{ role: 'user' as const, content: input.message }]
        : []),
    ];

    let leadSnapshot = lead;
    let turns = 0;

    try {
      while (turns < MAX_TURNS) {
        turns++;
        const assistantBlocks: (TextBlock | ToolUseBlock)[] = [];
        const toolResults: {
          toolUseId: string;
          content: string;
          isError: boolean;
        }[] = [];
        let stopReason = 'other';

        for await (const event of chat.streamWithTools(messages, LOAN_TOOLS, {
          provider: llmProvider,
        })) {
          if (event.type === 'text_delta') {
            const last = assistantBlocks[assistantBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text += event.text;
            } else {
              assistantBlocks.push({ type: 'text', text: event.text });
            }
            yield { type: 'token', text: event.text };
          } else if (event.type === 'tool_use_complete') {
            assistantBlocks.push({
              type: 'tool_use',
              id: event.id,
              name: event.name,
              input: event.input,
            });

            const execution = await this.executeTool({
              tool: event.name,
              input: event.input,
              toolUseId: event.id,
              lead: leadSnapshot,
            });
            toolResults.push({
              toolUseId: execution.toolUseId,
              content: execution.toolResult.content,
              isError: execution.toolResult.isError,
            });

            if (execution.event) yield execution.event;

            // Aplicar updates inmediatamente para que el siguiente turn del
            // LLM (en el mismo chat()) tenga el snapshot fresco.
            if (
              Object.keys(execution.leadUpdates).length > 0 ||
              execution.stageTransition
            ) {
              leadSnapshot = await this.applyLeadUpdates(
                leadSnapshot.id,
                execution.leadUpdates,
                execution.stageTransition,
              );
            }
          } else if (event.type === 'turn_end') {
            stopReason = event.stopReason;
          }
        }

        if (assistantBlocks.length === 0) {
          assistantBlocks.push({ type: 'text', text: '' });
        }
        messages.push({ role: 'assistant', content: assistantBlocks });

        // Persistir el turn del assistant.
        await this.persistAssistantTurn(lead.id, assistantBlocks);

        if (stopReason === 'tool_use' && toolResults.length > 0) {
          messages.push({
            role: 'user',
            content: toolResults.map((tr) => ({
              type: 'tool_result' as const,
              toolUseId: tr.toolUseId,
              content: tr.content,
              isError: tr.isError,
            })),
          });
          continue;
        }
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`chat failed: ${message}`);
      yield { type: 'error_event', message };
      return;
    }

    yield { type: 'done', leadId: lead.id, turns };
  }

  /**
   * Lee un lead por id, con tenancy enforcement.
   */
  async findById(tenantId: string, leadId: string): Promise<LoanLeadDto> {
    const lead = await this.loadLeadOrThrow(tenantId, leadId);
    return mapLeadToDto(lead);
  }

  /**
   * Lista paginada para el kanban. Devuelve hasta 200 leads ordenados por
   * `updatedAt` desc — para el demo sobra.
   */
  async list(tenantId: string): Promise<LoanLeadListItemDto[]> {
    const leads = await prisma.loanLead.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        stageHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return leads.map((lead) => ({
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      currentStage: lead.currentStage,
      requestedAmount: lead.requestedAmount?.toString() ?? null,
      termMonths: lead.termMonths,
      updatedAt: lead.updatedAt.toISOString(),
      lastStageReason: lead.stageHistory[0]?.reason ?? null,
    }));
  }

  /**
   * Conteos por etapa — para FunnelMetrics del oficial.
   */
  async metrics(tenantId: string): Promise<LoanFunnelMetricsDto> {
    const grouped = await prisma.loanLead.groupBy({
      by: ['currentStage'],
      where: { tenantId },
      _count: { _all: true },
    });
    const totals: Record<string, number> = {
      lead: 0,
      qualification: 0,
      documentation: 0,
      credit_evaluation: 0,
      approval: 0,
      disbursement: 0,
      servicing: 0,
      rejected: 0,
    };
    for (const row of grouped) {
      totals[row.currentStage] = row._count._all;
    }
    const rejected = totals.rejected;
    const active = Object.entries(totals)
      .filter(([k]) => k !== 'rejected')
      .reduce((acc, [, v]) => acc + v, 0);
    return {
      totals: totals as LoanFunnelMetricsDto['totals'],
      active,
      rejected,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async loadLeadOrThrow(tenantId: string, leadId: string) {
    const lead = await prisma.loanLead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) {
      throw new NotFoundException(
        `LoanLead ${leadId} no existe en tu cooperativa.`,
      );
    }
    return lead;
  }

  private async createBlankLead(tenantId: string) {
    return prisma.loanLead.create({
      data: {
        tenantId,
        fullName: '',
        phone: '',
        currentStage: 'lead',
      },
    });
  }

  private async loadConversationHistory(
    leadId: string,
  ): Promise<ChatRichMessage[]> {
    const history = await prisma.loanConversation.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      take: 60,
    });
    // Conversion simplista: ignoramos toolCall en la rehidratación inicial
    // porque el LLM rehidratado no tiene los mismos toolUseIds; los
    // anotamos como texto plano de la respuesta del bot.
    return history.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })) as ChatRichMessage[];
  }

  private async persistAssistantTurn(
    leadId: string,
    blocks: (TextBlock | ToolUseBlock)[],
  ) {
    const textParts = blocks
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const toolCallBlock = blocks.find(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );
    await prisma.loanConversation.create({
      data: {
        leadId,
        role: 'assistant',
        content: textParts,
        toolCall: toolCallBlock
          ? {
              name: toolCallBlock.name,
              input: toolCallBlock.input as object,
            }
          : undefined,
      },
    });
  }

  private async applyLeadUpdates(
    leadId: string,
    updates: Record<string, unknown>,
    stageTransition: ToolExecution['stageTransition'],
  ) {
    return prisma.$transaction(async (tx) => {
      if (stageTransition) {
        await tx.loanStageHistory.create({
          data: {
            leadId,
            fromStage: stageTransition.from,
            toStage: stageTransition.to,
            movedBy: 'llm',
            reason: stageTransition.reason,
          },
        });
        updates.currentStage = stageTransition.to;
      }
      return tx.loanLead.update({
        where: { id: leadId },
        data: updates as never,
      });
    });
  }

  private async executeTool(args: {
    tool: string;
    input: unknown;
    toolUseId: string;
    lead: LoanLead;
  }): Promise<ToolExecution> {
    const empty: ToolExecution = {
      toolUseId: args.toolUseId,
      toolResult: { content: '', isError: false },
      event: null,
      leadUpdates: {},
      stageTransition: null,
    };

    switch (args.tool) {
      case 'register_lead':
        return this.executeRegisterLead(args.input, empty);
      case 'request_document':
        return this.executeRequestDocument(args.input, empty);
      case 'consult_core_banking':
        return this.executeConsultCoreBanking(args.input, empty);
      case 'calculate_loan_eligibility':
        return this.executeCalculateEligibility(args.input, args.lead, empty);
      case 'move_to_stage':
        return this.executeMoveToStage(args.input, args.lead, empty);
      default:
        return {
          ...empty,
          toolResult: {
            content: `Tool desconocido: "${args.tool}".`,
            isError: true,
          },
        };
    }
  }

  private async executeRegisterLead(
    input: unknown,
    empty: ToolExecution,
  ): Promise<ToolExecution> {
    const parsed = parseRegisterLeadInput(input);
    if ('error' in parsed) {
      return {
        ...empty,
        toolResult: { content: parsed.error, isError: true },
      };
    }
    return {
      ...empty,
      toolResult: {
        content: `OK — socio registrado: ${parsed.fullName}, tel ${parsed.phone}.`,
        isError: false,
      },
      leadUpdates: {
        fullName: parsed.fullName,
        phone: parsed.phone,
        purpose: parsed.purpose,
      },
      event: {
        type: 'tool',
        tool: 'register_lead',
        summary: `Socio registrado: ${parsed.fullName}`,
        payload: parsed,
      },
    };
  }

  private async executeRequestDocument(
    input: unknown,
    empty: ToolExecution,
  ): Promise<ToolExecution> {
    const parsed = parseRequestDocumentInput(input);
    if ('error' in parsed) {
      return {
        ...empty,
        toolResult: { content: parsed.error, isError: true },
      };
    }
    const kindLabel = labelForKind(parsed.kind);
    return {
      ...empty,
      toolResult: {
        content: `OK — pedido al socio: ${kindLabel} (${parsed.reason}).`,
        isError: false,
      },
      event: {
        type: 'tool',
        tool: 'request_document',
        summary: `📎 Documento solicitado: ${kindLabel}`,
        payload: parsed,
      },
    };
  }

  private async executeConsultCoreBanking(
    input: unknown,
    empty: ToolExecution,
  ): Promise<ToolExecution> {
    const parsed = parseConsultCoreBankingInput(input);
    if ('error' in parsed) {
      return {
        ...empty,
        toolResult: { content: parsed.error, isError: true },
      };
    }
    let member: MemberInfo | null;
    try {
      member = await this.core.verifyMember({ idNumber: parsed.idNumber });
    } catch (err) {
      return {
        ...empty,
        toolResult: {
          content: `Error consultando el core: ${(err as Error).message.slice(0, 200)}`,
          isError: true,
        },
      };
    }
    if (!member) {
      return {
        ...empty,
        toolResult: {
          content: `Cédula ${parsed.idNumber} NO está registrada como socio. Sugerir al socio acercarse a oficina.`,
          isError: false,
        },
        event: {
          type: 'tool',
          tool: 'consult_core_banking',
          summary: `🔎 Cédula no encontrada en el core`,
          payload: { idNumber: parsed.idNumber, found: false },
        },
      };
    }
    let history: CreditHistory;
    try {
      history = await this.core.getCreditHistory(member.memberId);
    } catch (err) {
      return {
        ...empty,
        toolResult: {
          content: `Error consultando historial: ${(err as Error).message.slice(0, 200)}`,
          isError: true,
        },
      };
    }
    const payload = { member, history };
    return {
      ...empty,
      toolResult: {
        content: JSON.stringify(payload),
        isError: false,
      },
      leadUpdates: { idNumber: parsed.idNumber },
      event: {
        type: 'tool',
        tool: 'consult_core_banking',
        summary: `🔎 Datos del socio cargados (${member.fullName})`,
        payload,
      },
    };
  }

  private async executeCalculateEligibility(
    input: unknown,
    lead: LoanLead,
    empty: ToolExecution,
  ): Promise<ToolExecution> {
    const parsed = parseCalculateEligibilityInput(input);
    if ('error' in parsed) {
      return {
        ...empty,
        toolResult: { content: parsed.error, isError: true },
      };
    }
    const result = evaluateEligibility(parsed);
    return {
      ...empty,
      toolResult: {
        content: JSON.stringify(result),
        isError: false,
      },
      leadUpdates: {
        lastEligibility: result as unknown as object,
        ...(parsed.requestedAmountUsd !== Number(lead.requestedAmount)
          ? { requestedAmount: parsed.requestedAmountUsd }
          : {}),
        ...(parsed.termMonths !== lead.termMonths
          ? { termMonths: parsed.termMonths }
          : {}),
      },
      event: {
        type: 'tool',
        tool: 'calculate_loan_eligibility',
        summary: `🧮 ${result.verdict}`,
        payload: result satisfies EligibilityResult,
      },
    };
  }

  private async executeMoveToStage(
    input: unknown,
    lead: LoanLead,
    empty: ToolExecution,
  ): Promise<ToolExecution> {
    const parsed = parseMoveToStageInput(input);
    if ('error' in parsed) {
      return {
        ...empty,
        toolResult: { content: parsed.error, isError: true },
      };
    }
    const snapshot: LeadStageSnapshot = {
      currentStage: lead.currentStage,
      fullName: lead.fullName,
      phone: lead.phone,
      purpose: lead.purpose,
      idNumber: lead.idNumber,
      requestedAmount: lead.requestedAmount?.toString() ?? null,
      termMonths: lead.termMonths,
      lastEligibility: lead.lastEligibility as { eligible: boolean } | null,
      coreRequestId: lead.coreRequestId,
    };
    const validation = validateStageTransition(snapshot, parsed.toStage);
    if (!validation.ok) {
      return {
        ...empty,
        toolResult: { content: validation.error, isError: true },
      };
    }
    return {
      ...empty,
      toolResult: {
        content: `OK — etapa actualizada a ${parsed.toStage}.`,
        isError: false,
      },
      stageTransition: {
        from: validation.fromStage,
        to: validation.toStage,
        reason: parsed.reason,
      },
      event: {
        type: 'stage_changed',
        fromStage: validation.fromStage,
        toStage: validation.toStage,
        reason: parsed.reason,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers de mapping
// ---------------------------------------------------------------------------

function labelForKind(kind: string): string {
  if (kind === 'id_card') return 'cédula de identidad';
  if (kind === 'payroll') return 'rol de pagos';
  if (kind === 'utility_bill') return 'planilla de servicio básico';
  return kind;
}

function mapLeadToDto(lead: LoanLead): LoanLeadDto {
  return {
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone,
    idNumber: lead.idNumber,
    purpose: lead.purpose,
    requestedAmount: lead.requestedAmount?.toString() ?? null,
    termMonths: lead.termMonths,
    currentStage: lead.currentStage,
    coreRequestId: lead.coreRequestId,
    lastEligibility: lead.lastEligibility as EligibilityResult | null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
