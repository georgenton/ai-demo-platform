// -----------------------------------------------------------------------------
// FunnelMetrics — fila superior con 4 KPIs derivados del endpoint
// /loans/funnel/metrics.
//
//   1. Total activos (excluye rejected).
//   2. En evaluación (qualification + documentation + credit_evaluation).
//   3. Aprobados (approval + disbursement + servicing).
//   4. Drop-off (rejected sobre el total histórico).
// -----------------------------------------------------------------------------

'use client';

import { useT } from '@/lib/i18n';
import type { LoanFunnelMetrics } from '@/lib/api';

interface Props {
  metrics: LoanFunnelMetrics | null;
  refreshing: boolean;
}

export function FunnelMetrics({ metrics, refreshing }: Props) {
  const { t } = useT();

  // Computar valores derivados — todos defaultean a 0 si no hay metrics
  // aún (estado loading).
  const total = metrics ? metrics.active + metrics.rejected : 0;
  const enEvaluacion = metrics
    ? metrics.totals.qualification +
      metrics.totals.documentation +
      metrics.totals.credit_evaluation
    : 0;
  const aprobados = metrics
    ? metrics.totals.approval +
      metrics.totals.disbursement +
      metrics.totals.servicing
    : 0;
  const dropOffPct =
    total > 0 && metrics ? Math.round((metrics.rejected / total) * 100) : 0;

  return (
    <div className={`funnel-metrics${refreshing ? ' refreshing' : ''}`}>
      <Kpi
        label={t('funnel.metrics.active')}
        value={metrics?.active ?? 0}
        tone="brand"
      />
      <Kpi
        label={t('funnel.metrics.inEvaluation')}
        value={enEvaluacion}
        tone="accent"
      />
      <Kpi
        label={t('funnel.metrics.approved')}
        value={aprobados}
        tone="success"
      />
      <Kpi
        label={t('funnel.metrics.dropOff')}
        value={`${dropOffPct}%`}
        tone="danger"
        sublabel={t('funnel.metrics.dropOffHint', {
          rejected: String(metrics?.rejected ?? 0),
        })}
      />
    </div>
  );
}

interface KpiProps {
  label: string;
  value: number | string;
  sublabel?: string;
  tone: 'brand' | 'accent' | 'success' | 'danger';
}

function Kpi({ label, value, sublabel, tone }: KpiProps) {
  return (
    <div className={`funnel-kpi tone-${tone}`}>
      <div className="funnel-kpi-label">{label}</div>
      <div className="funnel-kpi-value">{value}</div>
      {sublabel && <div className="funnel-kpi-sublabel">{sublabel}</div>}
    </div>
  );
}
