// Tipos espejo de los endpoints /api/v1/agent y /agent/history.
// Ver ADR-0010 para la decisión de duplicar tipos vs paquete compartido.

import type { DemoId } from './types';

export interface AgentRequest {
  q: string;
  demoId?: DemoId;
}

// ---------------------------------------------------------------------------
// Eventos SSE tipados (espejo de apps/api/.../agent-events.ts)
// ---------------------------------------------------------------------------

export interface TokenEvent {
  type: 'token';
  text: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  sql: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  rowCount: number;
  durationMs: number;
  preview: Record<string, unknown>[];
  truncated: boolean;
}

export interface ToolErrorEvent {
  type: 'tool_error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
  turns: number;
  truncated: boolean;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type AgentEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Callbacks del stream del agente. El consumer recibe AgentEvent ya
 * deserializado y discriminado por `type` — listo para usar en un switch.
 */
export interface AgentStreamHandlers {
  onEvent: (event: AgentEvent) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface AgentSubscription {
  close: () => void;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface AgentHistoryEntry {
  id: string;
  question: string;
  sql: string | null;
  rowCount: number | null;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  turns: number;
  createdAt: string;
}

export interface AgentHistoryQuery {
  limit?: number;
  offset?: number;
}

export interface AgentHistoryResponse {
  items: AgentHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}
