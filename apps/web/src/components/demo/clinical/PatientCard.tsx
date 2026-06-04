// -----------------------------------------------------------------------------
// PatientCard — botón seleccionable del panel izquierdo.
//
// Muestra: nombre, edad + género (formateados con i18n), y hasta 2 chips de
// condiciones crónicas (el resto se resume como "+N").
//
// Estado seleccionado: borde mint + fondo mint suave (definido en CSS).
// -----------------------------------------------------------------------------

'use client';

import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n';
import type { ClinicalPatientSummary } from '@/lib/api';

interface Props {
  patient: ClinicalPatientSummary;
  selected: boolean;
  onSelect: () => void;
}

const MAX_CHIPS = 2;

/**
 * Map literal de género → key de i18n. Mantiene `t()` con keys del union
 * (template strings rompen el tipo). Si el backend manda otro valor de
 * género en el futuro (más allá de 'M' | 'F'), agregamos su entry acá.
 */
const GENDER_KEY: Record<string, StringKey> = {
  M: 'clinical.gender.M',
  F: 'clinical.gender.F',
};

export function PatientCard({ patient, selected, onSelect }: Props) {
  const { t } = useT();
  const shown = patient.chronicConditions.slice(0, MAX_CHIPS);
  const extra = patient.chronicConditions.length - shown.length;

  return (
    <button
      type="button"
      className={`patient-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <div className="patient-card-name">{patient.displayName}</div>
      <div className="patient-card-meta">
        {t('clinical.patient.age', { n: patient.age })} ·{' '}
        {GENDER_KEY[patient.gender]
          ? t(GENDER_KEY[patient.gender])
          : patient.gender}
      </div>
      {shown.length > 0 && (
        <div className="patient-card-chips">
          {shown.map((c) => (
            <span key={c} className="clin-chip">
              {c}
            </span>
          ))}
          {extra > 0 && <span className="clin-chip muted">+{extra}</span>}
        </div>
      )}
    </button>
  );
}
