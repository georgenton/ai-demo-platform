// -----------------------------------------------------------------------------
// DynamicChart — orquesta la elección del componente Recharts según el
// chartType de la spec.
//
// Si el chartType no está soportado, muestra mensaje de fallback en lugar
// de romper la UI.
// -----------------------------------------------------------------------------

'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';

import { useT } from '@/lib/i18n';
import type { BiChartSpec } from '@/lib/api';

import {
  SERIES_COLORS,
  coerceNumeric,
  formatAxisTick,
  rowsToObjects,
} from './charts/chart-utils';

interface Props {
  spec: BiChartSpec;
  columns: string[];
  rows: unknown[][];
}

const CHART_HEIGHT = 360;

export function DynamicChart({ spec, columns, rows }: Props) {
  const { t } = useT();

  // Convertir rows a objects + castear las columnas Y a Number.
  const numericKeys = spec.yAxis.map((y) => y.key);
  const data = coerceNumeric(rowsToObjects(columns, rows), numericKeys);

  if (data.length === 0) {
    return (
      <div className="bi-chart-empty">
        <span>{t('bi.rowsBlock.empty')}</span>
      </div>
    );
  }

  return (
    <div className="bi-chart">
      <div className="bi-chart-header">
        <h3 className="bi-chart-title">{spec.title}</h3>
        <span className="bi-ai-badge">{t('bi.aiBadge')}</span>
      </div>
      {spec.description && (
        <p className="bi-chart-description">{spec.description}</p>
      )}
      <div className="bi-chart-body" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(spec, data)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(
  spec: BiChartSpec,
  data: Array<Record<string, unknown>>,
): React.ReactElement {
  const xKey = spec.xAxis.key;
  switch (spec.chartType) {
    case 'line':
      return (
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => formatAxisTick(v)}
            stroke="var(--color-fg-muted)"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="var(--color-fg-muted)" tick={{ fontSize: 12 }} />
          <Tooltip />
          {spec.yAxis.length > 1 && <Legend />}
          {spec.yAxis.map((y, i) => (
            <Line
              key={y.key}
              type="monotone"
              dataKey={y.key}
              name={y.label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      );
    case 'bar':
      return (
        <BarChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => formatAxisTick(v)}
            stroke="var(--color-fg-muted)"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="var(--color-fg-muted)" tick={{ fontSize: 12 }} />
          <Tooltip />
          {spec.yAxis.length > 1 && <Legend />}
          {spec.yAxis.map((y, i) => (
            <Bar
              key={y.key}
              dataKey={y.key}
              name={y.label}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      );
    case 'area':
      return (
        <AreaChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => formatAxisTick(v)}
            stroke="var(--color-fg-muted)"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="var(--color-fg-muted)" tick={{ fontSize: 12 }} />
          <Tooltip />
          {spec.yAxis.length > 1 && <Legend />}
          {spec.yAxis.map((y, i) => (
            <Area
              key={y.key}
              type="monotone"
              dataKey={y.key}
              name={y.label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              fillOpacity={0.25}
            />
          ))}
        </AreaChart>
      );
    case 'pie': {
      const yKey = spec.yAxis[0]?.key ?? '';
      return (
        <PieChart>
          <Tooltip />
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={110}
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
    }
    case 'treemap': {
      const yKey = spec.yAxis[0]?.key ?? '';
      // Recharts Treemap espera children[] con name + size.
      const treeData = data.map((row, i) => ({
        name: String(row[xKey] ?? `Item ${i + 1}`),
        size: Number(row[yKey] ?? 0),
        fill: SERIES_COLORS[i % SERIES_COLORS.length],
      }));
      return (
        <Treemap
          data={treeData}
          dataKey="size"
          stroke="var(--color-bg)"
          fill="#0f3e6a"
        />
      );
    }
    case 'heatmap':
    default:
      return <UnsupportedChart />;
  }
}

function UnsupportedChart() {
  const { t } = useT();
  return (
    <div className="bi-chart-empty">
      <span>{t('bi.error.unsupportedChart')}</span>
    </div>
  );
}
