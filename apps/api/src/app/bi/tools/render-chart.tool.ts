// -----------------------------------------------------------------------------
// Tool `render_chart` — el LLM elige tipo de gráfico, eje X, series, título.
// El backend valida la spec y la propaga al frontend vía SSE.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import {
  BI_CHART_TYPES,
  type BiChartSpec,
  type BiChartType,
} from '../dto/bi.dto.js';

export const RENDER_CHART_TOOL: ChatTool = {
  name: 'render_chart',
  description:
    'Pide al frontend que renderice un gráfico con los datos del último run_sql. ' +
    'Llama después de tener los resultados; elige el tipo de gráfico apropiado: ' +
    '`line` para tendencias temporales, `bar` para comparar categorías, ' +
    '`area` para acumulados, `pie` para composición (<=8 categorías), ' +
    '`treemap` para composición jerárquica, `heatmap` para 2 dimensiones cruzadas. ' +
    'Indica las claves de las columnas tal como aparecen en los resultados (case-sensitive).',
  inputSchema: {
    type: 'object',
    properties: {
      chartType: {
        type: 'string',
        enum: ['line', 'bar', 'area', 'pie', 'treemap', 'heatmap'],
        description: 'Tipo de gráfico.',
      },
      title: {
        type: 'string',
        description:
          'Título corto y descriptivo en español (ej. "Morosidad por agencia en últimos 12 meses").',
      },
      xAxis: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Nombre de la columna (ej. "nombre", "mes").',
          },
          label: {
            type: 'string',
            description: 'Etiqueta legible (ej. "Agencia", "Mes").',
          },
        },
        required: ['key', 'label'],
      },
      yAxis: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['key', 'label'],
        },
        description:
          'Una o varias series (multi-line/multi-bar). Para pie/treemap usar UNA sola.',
      },
      description: {
        type: 'string',
        description: 'Descripción opcional para tooltip o leyenda.',
      },
    },
    required: ['chartType', 'title', 'xAxis', 'yAxis'],
  },
};

export function parseRenderChartInput(
  input: unknown,
): BiChartSpec | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<BiChartSpec>;

  if (
    typeof o.chartType !== 'string' ||
    !BI_CHART_TYPES.includes(o.chartType as BiChartType)
  ) {
    return {
      error: `chartType inválido. Usar uno de: ${BI_CHART_TYPES.join(', ')}.`,
    };
  }
  if (typeof o.title !== 'string' || o.title.trim().length < 3) {
    return { error: 'title inválido — mínimo 3 caracteres.' };
  }
  if (
    !o.xAxis ||
    typeof o.xAxis !== 'object' ||
    typeof (o.xAxis as { key?: unknown }).key !== 'string' ||
    typeof (o.xAxis as { label?: unknown }).label !== 'string'
  ) {
    return { error: 'xAxis debe tener {key, label} como strings.' };
  }
  if (!Array.isArray(o.yAxis) || o.yAxis.length === 0) {
    return { error: 'yAxis debe ser un array con al menos una serie.' };
  }
  for (const y of o.yAxis) {
    if (
      !y ||
      typeof y !== 'object' ||
      typeof (y as { key?: unknown }).key !== 'string' ||
      typeof (y as { label?: unknown }).label !== 'string'
    ) {
      return {
        error: 'cada elemento de yAxis debe tener {key, label} como strings.',
      };
    }
  }

  // Restricciones de un solo eje para pie/treemap.
  if (
    (o.chartType === 'pie' || o.chartType === 'treemap') &&
    o.yAxis.length > 1
  ) {
    return {
      error: `${o.chartType} solo admite una serie en yAxis (la métrica). Usa otro chartType para multi-serie.`,
    };
  }

  return {
    chartType: o.chartType as BiChartType,
    title: o.title.trim(),
    xAxis: {
      key: (o.xAxis as { key: string }).key,
      label: (o.xAxis as { label: string }).label,
    },
    yAxis: o.yAxis.map((y) => ({
      key: (y as { key: string }).key,
      label: (y as { label: string }).label,
    })),
    description: typeof o.description === 'string' ? o.description : undefined,
  };
}
