// -----------------------------------------------------------------------------
// DTOs del LoansModule (Demo 09 — sub-PR 2).
//
// Contratos REST + tipos de eventos del stream SSE. El frontend (sub-PRs 3
// y 4) consume estos shapes — viven acá como source of truth.
// -----------------------------------------------------------------------------

import { IsOptional, IsString, MaxLength } from 'class-validator';

import type { LoanStage } from '@org/db';

/** Mensaje que el socio envía al bot durante el chat. */
export class ChatLoanRequestDto {
  /**
   * Id del lead existente. Si está vacío, el backend crea uno nuevo en
   * etapa `lead`. Vital para mantener el hilo conversacional cuando el
   * socio reabre la app.
   */
  @IsOptional()
  @IsString()
  leadId?: string;

  /** Texto del socio. Vacío si el primer mensaje es del bot saludando. */
  @IsString()
  @MaxLength(2000, {
    message:
      'message excede 2000 caracteres — pedí al socio mensajes más cortos.',
  })
  message!: string;
}

/**
 * Resumen del lead que devuelve `GET /loans/:id` y se inyecta como
 * snapshot inicial cuando se abre `/demo/loans`. Forma 1:1 con
 * `LoanLead` de Prisma + relaciones planas.
 */
export interface LoanLeadDto {
  id: string;
  fullName: string;
  phone: string;
  idNumber: string | null;
  purpose: string | null;
  requestedAmount: string | null;
  termMonths: number | null;
  currentStage: LoanStage;
  coreRequestId: string | null;
  lastEligibility: EligibilityResult | null;
  createdAt: string;
  updatedAt: string;
}

/** Item de la lista para el kanban del oficial. */
export interface LoanLeadListItemDto {
  id: string;
  fullName: string;
  phone: string;
  currentStage: LoanStage;
  requestedAmount: string | null;
  termMonths: number | null;
  updatedAt: string;
  /** Última razón de movimiento de etapa (para mostrar como tooltip). */
  lastStageReason: string | null;
}

/**
 * Resultado de la tool `calculate_loan_eligibility`. Se persiste en
 * `LoanLead.lastEligibility` (JSON) y se muestra en la vista del oficial.
 */
export interface EligibilityResult {
  /** Si el préstamo se considera aprobable bajo las reglas actuales. */
  eligible: boolean;
  /** Veredicto en español neutral para mostrar al socio. */
  verdict: string;
  /**
   * Razón corta (1-2 oraciones). El bot la cita en la conversación;
   * el kanban la muestra como subtítulo de la tarjeta.
   */
  reason: string;
  /** Monto máximo aprobable según las reglas (en USD). */
  maxAmountUsd: string | null;
  /** Tasa de interés anual sugerida (porcentaje, ej. 14.5). */
  suggestedRateAnnual: number | null;
  /** Cuota mensual estimada al monto solicitado (puede ser distinta del max). */
  estimatedMonthlyPayment: string | null;
  /** Ratio cuota/ingreso del socio (cuota / ingreso mensual). */
  paymentToIncomeRatio: number | null;
}

// -------------------------------------------------------------------------
// Eventos del SSE — uno por mensaje en el stream.
// -------------------------------------------------------------------------

/** Texto incremental del bot — el cliente lo concatena al bubble. */
export interface ChatTokenEvent {
  type: 'token';
  text: string;
}

/**
 * El bot ejecutó una tool. El cliente puede mostrar un "evento de
 * sistema" pequeño en el chat (ej. "📎 Documento solicitado: rol_de_pagos").
 */
export interface ChatToolEvent {
  type: 'tool';
  tool:
    | 'register_lead'
    | 'request_document'
    | 'consult_core_banking'
    | 'calculate_loan_eligibility'
    | 'move_to_stage';
  /** Resultado human-readable de la tool (lo que el cliente muestra). */
  summary: string;
  /** Payload exacto que devolvió la tool (para debugging y la vista del oficial). */
  payload: unknown;
}

/**
 * El lead se movió a una etapa nueva — el frontend actualiza el badge.
 * Solo se emite cuando `move_to_stage` valida los criterios de salida y
 * persiste la transición.
 */
export interface ChatStageChangedEvent {
  type: 'stage_changed';
  fromStage: LoanStage | null;
  toStage: LoanStage;
  reason: string | null;
}

/** Errores del LLM / red — el cliente muestra reintentar. */
export interface ChatErrorEvent {
  type: 'error_event';
  message: string;
}

/** Fin del turno conversacional. */
export interface ChatDoneEvent {
  type: 'done';
  leadId: string;
  turns: number;
}

export type LoanChatEvent =
  | ChatTokenEvent
  | ChatToolEvent
  | ChatStageChangedEvent
  | ChatErrorEvent
  | ChatDoneEvent;

/**
 * Conteos de leads por etapa — alimenta `FunnelMetrics` del oficial.
 * Suma rejected como una categoría aparte para que el funnel "normal"
 * cuadre con la cantidad de prospects activos.
 */
export interface LoanFunnelMetricsDto {
  totals: Record<LoanStage, number>;
  /** Total de leads activos (no `rejected`). */
  active: number;
  /** Total de leads en `rejected` (drop-off acumulado). */
  rejected: number;
}
