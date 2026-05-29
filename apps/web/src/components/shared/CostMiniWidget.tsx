// -----------------------------------------------------------------------------
// CostMiniWidget — widget compacto para mostrar el costo en cada demo.
//
// Dos filas:
//   1. "Esta sesión": tokens de la sesión actual + costo equivalente.
//   2. "A escala": proyección mensual editable (usuarios × frecuencia →
//      costo/mes), con popover para editar los dos parámetros.
//
// Cuando la sesión actual está vacía (tokens = 0), la proyección usa un
// valor de referencia conservador del demo (definido en cost-defaults.ts),
// así el número mensual se muestra siempre — el cliente no ve "$0/mes"
// inicial.
//
// Si el pricing aún no cargó, el widget no se renderiza (return null) —
// evitamos "Loading…" arriba en el header.
// -----------------------------------------------------------------------------

'use client';

import { useMemo, useState } from 'react';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { DemoId, TutorPricingResponse, TutorUsage } from '@/lib/api';

import {
  costOfSession,
  projectMonthlyCost,
  type MonthlyProjectionParams,
} from '@/components/demo/tutor/cost-projection';
import { DEMO_COST_DEFAULTS } from './cost-defaults';
import { CostScaleEditor } from './CostScaleEditor';

export interface CostMiniWidgetProps {
  /** Tokens (estimados o reales) acumulados de la sesión actual. */
  usage: TutorUsage;
  /** Respuesta del endpoint /api/v1/tutor/pricing. */
  pricing: TutorPricingResponse | null;
  /**
   * Demo al que pertenece el widget. Determina label de la frecuencia,
   * defaults de usuarios + uses, y tokens de referencia cuando la sesión
   * todavía está vacía.
   */
  demoId: DemoId;
}

const FMT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const FMT_USD_LARGE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const FMT_INT = new Intl.NumberFormat('en-US');

function formatUsdSmart(value: number): string {
  if (value >= 100) return FMT_USD_LARGE.format(value);
  return FMT_USD.format(value);
}

export function CostMiniWidget({
  usage,
  pricing,
  demoId,
}: CostMiniWidgetProps) {
  const { t } = useT();
  const defaults = DEMO_COST_DEFAULTS[demoId];
  const totalTokens = usage.inputTokens + usage.outputTokens;

  // Estado local de los parámetros editables. Inicializa con los defaults
  // del demo; el usuario los modifica en el popover.
  const [params, setParams] = useState<MonthlyProjectionParams>({
    users: defaults.defaultUsers,
    usesPerUserPerMonth: defaults.defaultUsesPerUserPerMonth,
  });
  const [editorOpen, setEditorOpen] = useState(false);

  // Costo de la sesión actual (fila 1).
  const sessionCostUsd = useMemo(() => {
    if (!pricing || !pricing.providers[0]) return null;
    return costOfSession(usage, pricing.providers[0]);
  }, [pricing, usage]);

  // Tokens por uso a usar en la proyección: si la sesión actual tiene
  // datos, los promediamos como "consulta típica"; si está vacía, caemos
  // al valor de referencia conservador del demo.
  const tokensPerUse: TutorUsage = useMemo(() => {
    if (totalTokens > 0) return usage;
    return defaults.referenceTokensPerUse;
  }, [totalTokens, usage, defaults.referenceTokensPerUse]);

  // Proyección mensual (fila 2).
  const monthly = useMemo(() => {
    if (!pricing || !pricing.providers[0]) return null;
    return projectMonthlyCost(tokensPerUse, params, pricing.providers[0]);
  }, [pricing, tokensPerUse, params]);

  if (!pricing || sessionCostUsd === null || monthly === null) return null;

  const provider = pricing.providers[0];
  const providerShort = provider.displayName.split(' ').slice(-2).join(' ');

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 12px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        background: 'var(--color-bg-sunken)',
        fontSize: 12,
      }}
    >
      {/* Fila 1 — Esta sesión */}
      <div
        title={t('costMini.tooltip', {
          provider: provider.displayName,
          priceIn: provider.pricePerMillionInput,
          priceOut: provider.pricePerMillionOutput,
        })}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <Icon name="zap" size={13} />
          <span style={{ color: 'var(--color-fg-muted)' }}>
            {t('costMini.session')}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
            {FMT_INT.format(totalTokens)} {t('costMini.tokensShort')}
          </span>
        </div>
        <Divider />
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-fg-muted)' }}>
            {providerShort}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
            {FMT_USD.format(sessionCostUsd)}
          </span>
        </div>
        <Divider />
        <NaiBadge />
      </div>

      {/* Fila 2 — A escala (proyección mensual) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderTop: '1px dashed var(--color-border-subtle)',
          paddingTop: 6,
        }}
      >
        <Icon name="trending-up" size={13} />
        <span style={{ color: 'var(--color-fg-muted)' }}>
          {t('costMini.scale.prefix', {
            users: FMT_INT.format(params.users),
            uses: FMT_INT.format(params.usesPerUserPerMonth),
            unit: t(defaults.usesLabelKey),
          })}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--color-fg)' }}>
          {formatUsdSmart(monthly.monthlyCostUsd)}
          {t('costMini.scale.perMonth')}
        </span>
        <div
          className="row"
          style={{
            gap: 4,
            alignItems: 'center',
            padding: '2px 6px',
            borderRadius: 6,
            background: 'var(--color-success-bg)',
          }}
        >
          <span style={{ color: 'var(--color-fg-muted)' }}>NAI</span>
          <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
            $0
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          aria-label={t('costMini.editor.open')}
          title={t('costMini.editor.open')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            marginLeft: 'auto',
            color: 'var(--color-fg-muted)',
            display: 'inline-flex',
            borderRadius: 4,
          }}
        >
          <Icon name="pencil" size={12} strokeWidth={2} />
        </button>
      </div>

      <CostScaleEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        values={params}
        onChange={setParams}
        usesLabelKey={defaults.usesLabelKey}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponentes locales
// -----------------------------------------------------------------------------

function Divider() {
  return (
    <div
      style={{ height: 12, width: 1, background: 'var(--color-border)' }}
      aria-hidden
    />
  );
}

function NaiBadge() {
  return (
    <div
      className="row"
      style={{
        gap: 4,
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 6,
        background: 'var(--color-success-bg)',
      }}
    >
      <span style={{ color: 'var(--color-fg-muted)' }}>NAI</span>
      <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>$0</span>
    </div>
  );
}
