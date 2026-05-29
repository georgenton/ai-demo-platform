// -----------------------------------------------------------------------------
// CostMiniWidget — widget compacto para mostrar el costo de una sesión.
//
// Lo usa cada demo (01/02/03/04) en la esquina superior derecha del header.
// Muestra:
//   - Tokens estimados (input + output sumados).
//   - Costo en USD con el pricing de Anthropic Sonnet (provider[0]).
//   - "$0 NAI on-prem" como contraste fijo.
//
// Tooltip al hover explica que la estimación es por ~4 chars/token y deja
// claro que NO son tokens auditables — sirven para contraste visual.
//
// Si el pricing aún está cargando o falló, el widget no se renderiza
// (return null) — no queremos mostrar "loading…" arriba en el header de
// cada demo, sería visualmente ruidoso.
// -----------------------------------------------------------------------------

'use client';

import { useMemo } from 'react';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { TutorPricingResponse, TutorUsage } from '@/lib/api';

import { costOfSession } from '@/components/demo/tutor/cost-projection';

export interface CostMiniWidgetProps {
  /** Tokens (estimados o reales) acumulados de la sesión actual. */
  usage: TutorUsage;
  /** Respuesta del endpoint /api/v1/tutor/pricing. */
  pricing: TutorPricingResponse | null;
}

const FMT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const FMT_INT = new Intl.NumberFormat('en-US');

export function CostMiniWidget({ usage, pricing }: CostMiniWidgetProps) {
  const { t } = useT();
  const totalTokens = usage.inputTokens + usage.outputTokens;

  const sessionCostUsd = useMemo(() => {
    if (!pricing || !pricing.providers[0]) return null;
    return costOfSession(usage, pricing.providers[0]);
  }, [pricing, usage]);

  if (!pricing || sessionCostUsd === null) return null;

  const provider = pricing.providers[0];

  return (
    <div
      title={t('costMini.tooltip', {
        provider: provider.displayName,
        priceIn: provider.pricePerMillionInput,
        priceOut: provider.pricePerMillionOutput,
      })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        background: 'var(--color-bg-sunken)',
        fontSize: 12,
      }}
    >
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <Icon name="zap" size={13} />
        <span style={{ color: 'var(--color-fg-muted)' }}>
          {t('costMini.tokens')}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
          {FMT_INT.format(totalTokens)}
        </span>
      </div>
      <div
        style={{
          height: 14,
          width: 1,
          background: 'var(--color-border)',
        }}
        aria-hidden
      />
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--color-fg-muted)' }}>
          {provider.displayName.split(' ').slice(-2).join(' ')}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
          {FMT_USD.format(sessionCostUsd)}
        </span>
      </div>
      <div
        style={{
          height: 14,
          width: 1,
          background: 'var(--color-border)',
        }}
        aria-hidden
      />
      <div
        className="row"
        style={{
          gap: 6,
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 6,
          background: 'var(--color-success-bg)',
        }}
      >
        <span style={{ color: 'var(--color-fg-muted)' }}>NAI</span>
        <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
          $0
        </span>
      </div>
    </div>
  );
}
