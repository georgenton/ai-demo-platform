// -----------------------------------------------------------------------------
// CostScaleEditor — popover compacto para editar los parámetros de escala.
//
// Dos inputs:
//   1. Usuarios activos al mes.
//   2. Frecuencia/usuario/mes (consultas / comparaciones / búsquedas / queries).
//
// Sin librería de popover externa — usamos un wrapper relative + absolute
// con un overlay invisible que captura clicks afuera para cerrar. Patrón
// estándar y suficiente para un popover de 2 campos.
//
// El editor es controlado: recibe values + onChange. La página padre
// (CostMiniWidget) decide cuándo abrirlo y guarda los valores en su
// estado local.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef } from 'react';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n';

import type { MonthlyProjectionParams } from '@/components/demo/tutor/cost-projection';

export interface CostScaleEditorProps {
  open: boolean;
  onClose: () => void;
  values: MonthlyProjectionParams;
  onChange: (next: MonthlyProjectionParams) => void;
  /** Key i18n del label de la frecuencia ("Consultas/mes", etc.). */
  usesLabelKey: StringKey;
}

export function CostScaleEditor({
  open,
  onClose,
  values,
  onChange,
  usesLabelKey,
}: CostScaleEditorProps) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar con Escape además del click afuera — accesible y estándar.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay invisible captura clicks afuera */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9,
          background: 'transparent',
        }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-label={t('costMini.editor.title')}
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          zIndex: 10,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 14,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
          minWidth: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div className="row" style={{ gap: 6 }}>
            <Icon name="settings-2" size={14} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {t('costMini.editor.title')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--color-fg-muted)',
              display: 'inline-flex',
            }}
          >
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        <NumberField
          label={t('costMini.editor.users')}
          value={values.users}
          min={1}
          step={10}
          onChange={(v) => onChange({ ...values, users: v })}
        />
        <NumberField
          label={t(usesLabelKey)}
          value={values.usesPerUserPerMonth}
          min={1}
          step={5}
          onChange={(v) => onChange({ ...values, usesPerUserPerMonth: v })}
        />

        <div
          style={{
            fontSize: 11,
            color: 'var(--color-fg-subtle)',
            lineHeight: 1.5,
          }}
        >
          {t('costMini.editor.hint')}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Subcomponente local — input numérico con label.
// -----------------------------------------------------------------------------

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, step, onChange }: NumberFieldProps) {
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
