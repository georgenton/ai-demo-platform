// -----------------------------------------------------------------------------
// DTOs del BiModule (Demo 10, sub-PR 2).
//
// Contratos REST + tipos de eventos del stream SSE. El frontend (sub-PR 3)
// consume estos shapes — viven acá como source of truth.
// -----------------------------------------------------------------------------

import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Mensaje que el usuario envía al bot durante el chat de BI. */
export class BiChatRequestDto {
  /**
   * Id de conversación previo. Si vacío, arranca conversación nueva. Por
   * ahora no persistimos las conversaciones en BD — el id es por
   * sesión del cliente. Sub-PR 4 sumará persistencia.
   */
  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Pregunta del usuario en español. */
  @IsString()
  @MaxLength(800, {
    message: 'Pregunta excede 800 caracteres — sé más conciso.',
  })
  message!: string;
}

/** Tipos de gráfico que la tool render_chart puede pedir. */
export const BI_CHART_TYPES = [
  'line',
  'bar',
  'area',
  'pie',
  'treemap',
  'heatmap',
] as const;
export type BiChartType = (typeof BI_CHART_TYPES)[number];

/**
 * Spec del gráfico que el LLM emite vía render_chart. El frontend la
 * recibe vía SSE y dispara el componente Recharts apropiado.
 */
export interface BiChartSpec {
  chartType: BiChartType;
  title: string;
  /**
   * Eje X — la clave del row (nombre de columna) y un label legible.
   * Para pie/treemap, xAxis es la categoría.
   */
  xAxis: { key: string; label: string };
  /**
   * Series del eje Y. Permite multi-line/multi-bar. Para pie/treemap es
   * un solo elemento.
   */
  yAxis: ReadonlyArray<{ key: string; label: string }>;
  /** Descripción opcional para tooltip o leyenda. */
  description?: string;
}

// -------------------------------------------------------------------------
// Eventos SSE
// -------------------------------------------------------------------------

/** Token incremental del bot — el cliente lo acumula en la narrativa. */
export interface BiChatTokenEvent {
  type: 'token';
  text: string;
}

/**
 * El bot ejecutó SQL — emitimos el SQL EJECUTADO (después de sanitizar)
 * para mostrarlo en la UI debajo de "Ver SQL".
 */
export interface BiChatSqlEvent {
  type: 'sql';
  sql: string;
  /** Tablas que el LLM tocó — útil para tooltip "consultando: BiPrestamo, BiAgencia". */
  tablesUsed: string[];
}

/** Filas devueltas por la ejecución. El frontend las muestra en tabla. */
export interface BiChatRowsEvent {
  type: 'rows';
  /** Nombres de columna en el orden del SELECT. */
  columns: string[];
  /** Hasta 1000 filas (LIMIT inyectado por sql-safety). */
  rows: unknown[][];
  /** Total devuelto. Si == LIMIT, indica posible truncado. */
  rowCount: number;
}

/** El LLM eligió tipo de gráfico — el cliente lo renderiza. */
export interface BiChatChartEvent {
  type: 'chart';
  spec: BiChartSpec;
}

/** Errores del LLM, del SQL o de la red. */
export interface BiChatErrorEvent {
  type: 'error_event';
  message: string;
}

/** Fin del turno conversacional. */
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
