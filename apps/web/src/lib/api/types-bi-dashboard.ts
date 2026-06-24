// -----------------------------------------------------------------------------
// Tipos del dashboard guardado del Demo 10 (sub-PR 4).
// -----------------------------------------------------------------------------

import type { BiChartSpec } from './types-bi';

export interface BiDashboardItem {
  id: string;
  title: string;
  question: string;
  sql: string;
  tablesUsed: string[];
  /** Misma shape que `BiChartSpec` pero acepta JSON opaco por compatibilidad. */
  chartSpec: BiChartSpec;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardItemInput {
  title: string;
  question: string;
  sql: string;
  chartSpec: BiChartSpec;
}

export interface UpdateDashboardItemInput {
  title?: string;
  order?: number;
}

export interface BiDashboardItemExecuteResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executedAt: string;
}
