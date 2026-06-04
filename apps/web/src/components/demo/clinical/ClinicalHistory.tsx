// -----------------------------------------------------------------------------
// ClinicalHistory — panel central. Renderiza la historia del paciente
// seleccionado: datos demográficos, alergias, condiciones crónicas, medicación
// actual y accordion de las últimas consultas.
//
// Decisiones de diseño (todas heredadas del wiring de Claude Design):
//   - Las secciones se muestran SIEMPRE, aun cuando estén vacías ("Ninguna
//     registrada"). Que el médico vea que el dato fue chequeado, no que falta.
//   - La PRIMERA consulta (más reciente) arranca expandida; el resto colapsado.
//   - El backend ya manda las consultas DESC por fecha — no reordenar.
//   - La fecha (string ISO) se formatea a YYYY-MM-DD para una lectura corta;
//     `new Date(...).toISOString().slice(0,10)` evita problemas de timezone
//     en la primera vista (no necesitamos hora aquí).
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { EmptyState, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n';
import type { ClinicalConsultation, ClinicalPatientDetail } from '@/lib/api';

/** Map literal: género del backend → key i18n (ver nota en PatientCard.tsx). */
const GENDER_KEY: Record<string, StringKey> = {
  M: 'clinical.gender.M',
  F: 'clinical.gender.F',
};

interface Props {
  patient: ClinicalPatientDetail | null;
}

export function ClinicalHistory({ patient }: Props) {
  const { t } = useT();

  if (!patient) {
    return (
      <div style={{ padding: 16 }}>
        <EmptyState
          icon="user-round"
          title={t('clinical.empty.history')}
          body=""
        />
      </div>
    );
  }

  return (
    <div>
      <div className="clin-section">
        <div className="clin-patient-name">{patient.displayName}</div>
        <div className="clin-patient-meta">
          {t('clinical.patient.age', { n: patient.age })} ·{' '}
          {GENDER_KEY[patient.gender]
            ? t(GENDER_KEY[patient.gender])
            : patient.gender}
          {patient.externalId ? ` · ${patient.externalId}` : ''}
        </div>
      </div>

      <ChipsSection
        label={t('clinical.section.allergies')}
        items={patient.allergies}
        emptyLabel={t('clinical.none')}
        variant="allergy"
      />

      <ChipsSection
        label={t('clinical.section.conditions')}
        items={patient.chronicConditions}
        emptyLabel={t('clinical.none')}
        variant="default"
      />

      <div className="clin-section">
        <div className="clin-section-label">
          {t('clinical.section.medications')}
        </div>
        {patient.currentMedications.length > 0 ? (
          <div className="med-list">
            {patient.currentMedications.map((m) => (
              <div className="med-row" key={m}>
                <span className="bullet" />
                {m}
              </div>
            ))}
          </div>
        ) : (
          <span className="clin-chip muted">{t('clinical.none')}</span>
        )}
      </div>

      <div className="clin-section">
        <div className="clin-section-label">
          {t('clinical.section.consultations')}
        </div>
        {patient.consultations.map((c, i) => (
          <Consultation key={c.id} consultation={c} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes co-localizados
// ---------------------------------------------------------------------------

function ChipsSection({
  label,
  items,
  emptyLabel,
  variant,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
  variant: 'default' | 'allergy';
}) {
  return (
    <div className="clin-section">
      <div className="clin-section-label">{label}</div>
      <div className="patient-card-chips">
        {items.length === 0 ? (
          <span className="clin-chip muted">{emptyLabel}</span>
        ) : (
          items.map((item) =>
            variant === 'allergy' ? (
              <span key={item} className="clin-chip clin-chip-allergy">
                <Icon name="triangle-alert" size={11} />
                {item}
              </span>
            ) : (
              <span key={item} className="clin-chip">
                {item}
              </span>
            ),
          )
        )}
      </div>
    </div>
  );
}

function Consultation({
  consultation,
  defaultOpen,
}: {
  consultation: ClinicalConsultation;
  defaultOpen: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  const dateStr = consultation.date.slice(0, 10);

  return (
    <div className={`consult${open ? ' open' : ''}`}>
      <button
        type="button"
        className="consult-head"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="consult-date">{dateStr}</span>
        <span className="consult-reason">{consultation.reasonForVisit}</span>
        <Icon name="chevron-right" size={15} className="consult-chevron" />
      </button>
      {open && (
        <div className="consult-body">
          <Field
            label={t('clinical.consult.physician')}
            value={consultation.treatingPhysician}
          />
          <Field
            label={t('clinical.consult.reason')}
            value={consultation.reasonForVisit}
          />
          <Field
            label={t('clinical.consult.exam')}
            value={consultation.examFindings}
          />
          <Field
            label={t('clinical.consult.diagnosis')}
            value={consultation.diagnosis}
          />
          <Field
            label={t('clinical.consult.treatment')}
            value={consultation.treatment}
          />
          <Field
            label={t('clinical.consult.notes')}
            value={consultation.notes}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div className="consult-field-label">{label}</div>
      <div className="consult-field-value">{value}</div>
    </div>
  );
}
