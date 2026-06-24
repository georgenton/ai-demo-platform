// -----------------------------------------------------------------------------
// Tipos del cliente del Demo 10 (BI dinámico).
//
// Espejo del backend (apps/api/src/app/bi/dto/bi.dto.ts). Mantener en sync.
// -----------------------------------------------------------------------------

export const BI_CHART_TYPES = [
  'line',
  'bar',
  'area',
  'pie',
  'treemap',
  'heatmap',
] as const;
export type BiChartType = (typeof BI_CHART_TYPES)[number];

export interface BiChartSpec {
  chartType: BiChartType;
  title: string;
  xAxis: { key: string; label: string };
  yAxis: ReadonlyArray<{ key: string; label: string }>;
  description?: string;
}

// ---------------------------------------------------------------------------
// Eventos del SSE
// ---------------------------------------------------------------------------

export interface BiChatTokenEvent {
  type: 'token';
  text: string;
}

export interface BiChatSqlEvent {
  type: 'sql';
  sql: string;
  tablesUsed: string[];
}

export interface BiChatRowsEvent {
  type: 'rows';
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export interface BiChatChartEvent {
  type: 'chart';
  spec: BiChartSpec;
}

export interface BiChatErrorEvent {
  type: 'error_event';
  message: string;
}

export interface BiChatDoneEvent {
  type: 'done';
  conversationId: string;
  turns: number;
}

export type BiChatEvent =
  | BiChatTokenEvent
  | BiChatSqlEvent
  | BiChatRowsEvent
  | BiChatChartEvent
  | BiChatErrorEvent
  | BiChatDoneEvent;

export interface BiChatStreamHandlers {
  onEvent: (event: BiChatEvent) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface BiChatSubscription {
  close: () => void;
}

export interface BiChatRequest {
  conversationId?: string;
  message: string;
}
