// -----------------------------------------------------------------------------
// DynamicChart — orquesta la elección del componente Recharts según el
// chartType de la spec.
//
// Si el chartType no está soportado, muestra mensaje de fallback en lugar
// de romper la UI.
// -----------------------------------------------------------------------------

'use client';

import type { CSSProperties } from 'react';
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

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { BiChartSpec, BiChartType } from '@/lib/api';

import {
  SERIES_COLORS,
  coerceNumeric,
  formatAxisTick,
  formatMetricValue,
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
  const numericKeys = [
    ...spec.yAxis.map((y) => y.key),
    ...(spec.zAxis ? [spec.zAxis.key] : []),
  ];
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
      <div className="bi-chart-recommendation">
        <div className="bi-chart-recommendation-kicker">
          <Icon name="sparkles" size={14} />
          <span>
            {t('bi.chartRecommendation.label', {
              chartType: chartTypeLabel(spec.chartType, t),
            })}
          </span>
        </div>
        <p>
          {spec.recommendationReason || t('bi.chartRecommendation.fallback')}
        </p>
      </div>
      <div className="bi-chart-body" style={{ height: CHART_HEIGHT }}>
        {spec.chartType === 'heatmap' ? (
          <HeatmapChart spec={spec} data={data} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(spec, data)}
          </ResponsiveContainer>
        )}
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

function HeatmapChart({
  spec,
  data,
}: {
  spec: BiChartSpec;
  data: Array<Record<string, unknown>>;
}) {
  const { t } = useT();
  const xKey = spec.xAxis.key;
  const yKey = spec.yAxis[0]?.key;
  const valueKey = spec.zAxis?.key;
  if (!yKey || !valueKey) return <UnsupportedChart />;

  const xCategories = uniqueValues(data.map((row) => row[xKey]));
  const yCategories = uniqueValues(data.map((row) => row[yKey]));
  const values = new Map<string, number>();
  let max = 0;
  for (const row of data) {
    const x = String(row[xKey] ?? '');
    const y = String(row[yKey] ?? '');
    const value = Number(row[valueKey] ?? 0);
    const safeValue = Number.isFinite(value) ? value : 0;
    values.set(heatmapKey(x, y), safeValue);
    max = Math.max(max, safeValue);
  }

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(112px, 1.15fr) repeat(${Math.max(xCategories.length, 1)}, minmax(76px, 1fr))`,
  };

  return (
    <div
      className="bi-heatmap"
      role="img"
      aria-label={t('bi.heatmap.aria', {
        x: spec.xAxis.label,
        y: spec.yAxis[0]?.label ?? '',
        value: spec.zAxis?.label ?? '',
      })}
    >
      <div className="bi-heatmap-grid" style={gridStyle}>
        <div className="bi-heatmap-corner" />
        {xCategories.map((x) => (
          <div key={x} className="bi-heatmap-col-head" title={x}>
            {formatAxisTick(x)}
          </div>
        ))}
        {yCategories.map((y) => (
          <HeatmapRow
            key={y}
            y={y}
            xCategories={xCategories}
            values={values}
            max={max}
          />
        ))}
      </div>
    </div>
  );
}

function HeatmapRow({
  y,
  xCategories,
  values,
  max,
}: {
  y: string;
  xCategories: string[];
  values: Map<string, number>;
  max: number;
}) {
  return (
    <>
      <div className="bi-heatmap-row-head" title={y}>
        {formatAxisTick(y)}
      </div>
      {xCategories.map((x) => {
        const value = values.get(heatmapKey(x, y)) ?? 0;
        const intensity = max > 0 ? value / max : 0;
        const alpha = Math.max(0.08, intensity * 0.82);
        const textIsLight = intensity > 0.58;
        return (
          <div
            key={`${y}-${x}`}
            className="bi-heatmap-cell"
            title={`${y} · ${x}: ${formatMetricValue(value)}`}
            style={{
              backgroundColor: `rgba(15, 62, 106, ${alpha})`,
              color: textIsLight ? '#fff' : 'var(--color-fg)',
            }}
          >
            {formatMetricValue(value)}
          </div>
        );
      })}
    </>
  );
}

function uniqueValues(values: unknown[]): string[] {
  return Array.from(new Set(values.map((v) => String(v ?? '')))).filter(
    Boolean,
  );
}

function heatmapKey(x: string, y: string): string {
  return `${x}\u0000${y}`;
}

function chartTypeLabel(
  chartType: BiChartType,
  t: ReturnType<typeof useT>['t'],
): string {
  switch (chartType) {
    case 'line':
      return t('bi.chartType.line');
    case 'area':
      return t('bi.chartType.area');
    case 'pie':
      return t('bi.chartType.pie');
    case 'treemap':
      return t('bi.chartType.treemap');
    case 'heatmap':
      return t('bi.chartType.heatmap');
    case 'bar':
    default:
      return t('bi.chartType.bar');
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
