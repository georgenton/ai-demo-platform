// -----------------------------------------------------------------------------
// TutorCostPanel — Panel 3 del Demo 05.
//
// La pieza diferenciadora del demo. Muestra:
//   - "Esta sesión": tokens acumulados de la conversación + costo equivalente
//     para Anthropic Sonnet vs NAI on-prem.
//   - "Proyección semestre": inputs editables (alumnos, sesiones/sem,
//     semanas) y cálculo extrapolado.
//
// El pricing llega del backend (GET /tutor/pricing) y se cachea local. El
// cálculo es pure math en el cliente — cero round-trip por cada slider.
// -----------------------------------------------------------------------------

'use client';

import { useMemo } from 'react';

import { Badge, Card, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { TutorPricingResponse, TutorUsage } from '@/lib/api';

import { projectSemesterCost, type ProjectionParams } from './cost-projection';

export interface TutorCostPanelProps {
  /** Acumulado de tokens de toda la conversación viva. */
  sessionUsage: TutorUsage;
  pricing: TutorPricingResponse | null;
  pricingLoading: boolean;
  pricingError: string | null;
  params: ProjectionParams;
  onParamsChange: (params: ProjectionParams) => void;
}

const FMT_USD_FULL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FMT_USD_LARGE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const FMT_INT = new Intl.NumberFormat('en-US');

function formatUsd(value: number): string {
  if (value >= 1000) return FMT_USD_LARGE.format(value);
  return FMT_USD_FULL.format(value);
}

export function TutorCostPanel({
  sessionUsage,
  pricing,
  pricingLoading,
  pricingError,
  params,
  onParamsChange,
}: TutorCostPanelProps) {
  const { t } = useT();

  const sessionCost = useMemo(() => {
    if (!pricing) return null;
    const provider = pricing.providers[0]; // Anthropic Sonnet por defecto
    if (!provider) return null;
    return projectSemesterCost(
      sessionUsage,
      { students: 1, sessionsPerWeek: 1, weeksInSemester: 1 },
      provider,
    );
  }, [pricing, sessionUsage]);

  const projection = useMemo(() => {
    if (!pricing) return null;
    const provider = pricing.providers[0];
    if (!provider) return null;
    return projectSemesterCost(sessionUsage, params, provider);
  }, [pricing, sessionUsage, params]);

  const provider = pricing?.providers[0] ?? null;

  if (pricingError) {
    return (
      <Card style={{ padding: 16, color: 'var(--color-danger)' }}>
        {pricingError}
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <Icon name="dollar-sign" size={16} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {t('tutor.cost.title')}
          </span>
        </div>
        {pricingLoading && <Badge tone="info">…</Badge>}
      </div>

      {/* Sección 1 — Esta sesión */}
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {t('tutor.cost.session.eyebrow')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            fontSize: 13,
            color: 'var(--color-fg)',
          }}
        >
          <div>
            <div style={{ color: 'var(--color-fg-muted)' }}>
              {t('tutor.cost.tokensIn')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {FMT_INT.format(sessionUsage.inputTokens)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--color-fg-muted)' }}>
              {t('tutor.cost.tokensOut')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {FMT_INT.format(sessionUsage.outputTokens)}
            </div>
          </div>
        </div>
        {sessionCost && provider && (
          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <CostCell
              label={provider.displayName}
              value={formatUsd(sessionCost.semesterTotalUsd)}
              tone="provider"
            />
            <CostCell
              label={pricing?.naiOnPrem.displayName ?? ''}
              value="$0.00"
              tone="onprem"
            />
          </div>
        )}
      </div>

      {/* Sección 2 — Proyección semestre */}
      <div style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {t('tutor.cost.projection.eyebrow')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}
        >
          <NumberInput
            label={t('tutor.cost.students')}
            value={params.students}
            min={1}
            step={50}
            onChange={(v) => onParamsChange({ ...params, students: v })}
          />
          <NumberInput
            label={t('tutor.cost.sessionsPerWeek')}
            value={params.sessionsPerWeek}
            min={1}
            step={1}
            onChange={(v) => onParamsChange({ ...params, sessionsPerWeek: v })}
          />
          <NumberInput
            label={t('tutor.cost.weeks')}
            value={params.weeksInSemester}
            min={1}
            step={1}
            onChange={(v) => onParamsChange({ ...params, weeksInSemester: v })}
          />
        </div>

        {projection && provider && (
          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <CostCell
              label={provider.displayName}
              value={formatUsd(projection.semesterTotalUsd)}
              caption={t('tutor.cost.tokens.caption', {
                n: FMT_INT.format(projection.semesterTotalTokens),
              })}
              tone="provider"
            />
            <CostCell
              label={pricing?.naiOnPrem.displayName ?? ''}
              value="$0"
              caption={t('tutor.cost.onprem.caption')}
              tone="onprem"
            />
          </div>
        )}

        {provider && (
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: 'var(--color-fg-subtle)',
              lineHeight: 1.5,
            }}
          >
            {t('tutor.cost.source', {
              priceIn: provider.pricePerMillionInput,
              priceOut: provider.pricePerMillionOutput,
              capturedAt: provider.capturedAt,
            })}
            <br />
            <a
              href={provider.sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-fg-muted)' }}
            >
              {provider.sourceUrl}
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Subcomponentes locales
// -----------------------------------------------------------------------------

interface CostCellProps {
  label: string;
  value: string;
  caption?: string;
  tone: 'provider' | 'onprem';
}

function CostCell({ label, value, caption, tone }: CostCellProps) {
  // Usamos tokens que existen en AMBOS themes (light y dark) — los nombres
  // con sufijo *-soft / *-subtle del Sprint Demo 05 inicial NO estaban
  // definidos en tokens.css, caían al fallback hardcoded y rompían contraste
  // en dark mode. Los tokens correctos:
  //   --color-bg-sunken    — superficie hundida (light y dark).
  //   --color-success-bg   — fondo tinte mint (light: mint-100, dark: rgba).
  //   --color-success      — verde de texto/iconos.
  //   --color-border       — borde sutil que mejora contraste en dark.
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background:
          tone === 'onprem'
            ? 'var(--color-success-bg)'
            : 'var(--color-bg-sunken)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-fg-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: tone === 'onprem' ? 'var(--color-success)' : 'var(--color-fg)',
        }}
      >
        {value}
      </div>
      {caption && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-fg-subtle)',
            marginTop: 4,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberInput({ label, value, min, step, onChange }: NumberInputProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
        {label}
      </span>
      <input
        type="number"
        className="input"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(parsed)) {
            onChange(Math.max(min, parsed));
          }
        }}
      />
    </label>
  );
}
