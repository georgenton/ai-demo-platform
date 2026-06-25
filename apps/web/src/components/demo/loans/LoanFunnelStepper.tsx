// -----------------------------------------------------------------------------
// LoanFunnelStepper — barra horizontal con las 7 etapas del funnel de
// préstamos. La etapa actual del lead se resalta con accent + check en las
// previas. Cuando el bot avanza al lead (evento `stage_changed` del SSE),
// el badge se mueve solo sin re-render manual.
//
// Por qué este componente y no reusar el kanban de /demo/loans/funnel:
//   El kanban es la vista oficial (Excel del equipo). En el chat del socio
//   queremos algo más liviano que cuente la historia "voy avanzando" sin
//   distraer. Stepper = un solo eje horizontal, las 7 etapas no-laterales,
//   y el rechazo se muestra aparte como aviso si pasa.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import type { LoanStage } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Orden canónico del funnel. `rejected` se trata aparte (es ramal lateral,
 * no parte de la progresión normal).
 */
const STAGES: readonly Exclude<LoanStage, 'rejected'>[] = [
  'lead',
  'qualification',
  'documentation',
  'credit_evaluation',
  'approval',
  'disbursement',
  'servicing',
] as const;

interface LoanFunnelStepperProps {
  /** Etapa actual del lead activo, o `null` si todavía no hay lead creado. */
  stage: LoanStage | null;
}

export function LoanFunnelStepper({ stage }: LoanFunnelStepperProps) {
  const { t } = useT();

  // Caso ramal: rejected. No es parte del eje principal — mostramos un
  // banner aparte y dejamos el stepper en estado neutro (sin etapa activa).
  if (stage === 'rejected') {
    return (
      <div className="loan-funnel-rejected" role="status">
        <Icon name="x-circle" size={16} />
        <span>{t('loans.stage.rejected')}</span>
      </div>
    );
  }

  // Índice de la etapa actual en el eje. `null` = pre-lead (todavía no hay
  // conversación), todo gris.
  const activeIdx = stage ? STAGES.indexOf(stage) : -1;

  return (
    <ol
      className="loan-funnel-stepper"
      aria-label={t('loans.funnel.label')}
      role="list"
    >
      {STAGES.map((s, idx) => {
        const isPast = activeIdx >= 0 && idx < activeIdx;
        const isActive = idx === activeIdx;
        const state = isActive ? 'active' : isPast ? 'past' : 'upcoming';
        const labelKey = `loans.stage.${s}` as const;
        return (
          <li
            key={s}
            className={`loan-funnel-step state-${state}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="loan-funnel-dot" aria-hidden="true">
              {isPast ? (
                <Icon name="check" size={12} strokeWidth={2.5} />
              ) : (
                <span className="loan-funnel-dot-inner" />
              )}
            </span>
            <span className="loan-funnel-step-label">
              {t(labelKey as 'loans.stage.lead')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
