// -----------------------------------------------------------------------------
// Tipos del cliente del Demo 09 (Funnel de préstamos).
//
// Espejo del backend (apps/api/src/app/loans/dto/loans.dto.ts). Mantener
// en sync — cuando cambie la forma del backend, esto también.
// -----------------------------------------------------------------------------

export type LoanStage =
  | 'lead'
  | 'qualification'
  | 'documentation'
  | 'credit_evaluation'
  | 'approval'
  | 'disbursement'
  | 'servicing'
  | 'rejected';

export interface EligibilityResult {
  eligible: boolean;
  verdict: string;
  reason: string;
  maxAmountUsd: string | null;
  suggestedRateAnnual: number | null;
  estimatedMonthlyPayment: string | null;
  paymentToIncomeRatio: number | null;
}

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

export interface LoanLeadListItem {
  id: string;
  fullName: string;
  phone: string;
  currentStage: LoanStage;
  requestedAmount: string | null;
  termMonths: number | null;
  updatedAt: string;
  lastStageReason: string | null;
}

export interface LoanFunnelMetrics {
  totals: Record<LoanStage, number>;
  active: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Eventos del SSE
// ---------------------------------------------------------------------------

export type LoanToolName =
  | 'register_lead'
  | 'request_document'
  | 'consult_core_banking'
  | 'calculate_loan_eligibility'
  | 'move_to_stage';

export interface LoanChatTokenEvent {
  type: 'token';
  text: string;
}

export interface LoanChatToolEvent {
  type: 'tool';
  tool: LoanToolName;
  summary: string;
  payload: unknown;
}

export interface LoanChatStageChangedEvent {
  type: 'stage_changed';
  fromStage: LoanStage | null;
  toStage: LoanStage;
  reason: string | null;
}

export interface LoanChatErrorEvent {
  type: 'error_event';
  message: string;
}

export interface LoanChatDoneEvent {
  type: 'done';
  leadId: string;
  turns: number;
}

export type LoanChatEvent =
  | LoanChatTokenEvent
  | LoanChatToolEvent
  | LoanChatStageChangedEvent
  | LoanChatErrorEvent
  | LoanChatDoneEvent;

export interface LoanChatStreamHandlers {
  onEvent: (event: LoanChatEvent) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface LoanChatSubscription {
  close: () => void;
}

export interface LoanChatRequest {
  leadId?: string;
  message: string;
}
