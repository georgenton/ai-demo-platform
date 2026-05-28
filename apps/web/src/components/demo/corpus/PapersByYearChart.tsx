// -----------------------------------------------------------------------------
// PapersByYearChart — bar chart de cantidad de papers por año.
//
// Usa Recharts. Tokens del design system se reflejan vía CSS variables
// (no hard-coded colors).
// -----------------------------------------------------------------------------

'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, Eyebrow } from '@/components/ui';
import type { PapersByYearItem } from '@/lib/api';
import { useT } from '@/lib/i18n';

export interface PapersByYearChartProps {
  data: PapersByYearItem[];
}

export function PapersByYearChart({ data }: PapersByYearChartProps) {
  const { t } = useT();
  return (
    <Card style={{ minHeight: 220 }}>
      <Eyebrow>{t('corpus.chart.papersByYear')}</Eyebrow>

      {data.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 160,
            color: 'var(--color-fg-muted)',
            fontSize: 13,
          }}
        >
          {t('corpus.chart.empty')}
        </div>
      ) : (
        <div style={{ width: '100%', height: 160, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-subtle)"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border-subtle)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-bg-sunken)' }}
                contentStyle={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-fg)', fontWeight: 600 }}
                formatter={(value) => [String(value), t('corpus.chart.papers')]}
              />
              <Bar
                dataKey="count"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
