// -----------------------------------------------------------------------------
// Pantalla 1 — selección de rol + form del candidato.
//
// Co-localiza `RoleCard` y `CandidateForm`: son chicos, solo se usan acá, y
// el flujo está más claro leyéndolos en orden.
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { HrJobSummary } from '@/lib/api';

interface Props {
  jobs: HrJobSummary[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
  candidateName: string;
  setCandidateName: (v: string) => void;
  cedula: string;
  setCedula: (v: string) => void;
  onStart: () => void;
  starting: boolean;
  loading: boolean;
  error: string | null;
}

export function RoleSelect({
  jobs,
  selectedJobId,
  onSelect,
  candidateName,
  setCandidateName,
  cedula,
  setCedula,
  onStart,
  starting,
  loading,
  error,
}: Props) {
  const { t } = useT();

  return (
    <div className="iv-scroll">
      <div className="iv-select-wrap">
        <div className="iv-select-head">
          <span className="iv-eyebrow">{t('interview.eyebrow')}</span>
          <h2 className="iv-select-title">{t('interview.selectRole.title')}</h2>
          <p className="iv-select-sub">{t('interview.selectRole.subtitle')}</p>
        </div>

        {loading ? (
          <div className="iv-loading">{t('interview.selectRole.loading')}</div>
        ) : error ? (
          <div className="iv-error-banner">{error}</div>
        ) : (
          <div className="iv-role-grid">
            {jobs.map((job) => (
              <RoleCard
                key={job.id}
                job={job}
                selected={job.id === selectedJobId}
                onSelect={() => onSelect(job.id)}
              />
            ))}
          </div>
        )}

        {selectedJobId && (
          <CandidateForm
            candidateName={candidateName}
            setCandidateName={setCandidateName}
            cedula={cedula}
            setCedula={setCedula}
            onStart={onStart}
            starting={starting}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoleCard
// ---------------------------------------------------------------------------

const MAX_DIMENSION_CHIPS = 3;

function RoleCard({
  job,
  selected,
  onSelect,
}: {
  job: HrJobSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useT();
  const shown = job.dimensions.slice(0, MAX_DIMENSION_CHIPS);
  const extra = job.dimensions.length - shown.length;

  return (
    <button
      type="button"
      className={`iv-role-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <div className="iv-role-card-top">
        <span className="iv-role-icon">
          <Icon name="briefcase" size={16} />
        </span>
        {selected && (
          <span className="iv-role-check">
            <Icon name="check" size={14} strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className="iv-role-name">{job.title}</div>
      <p className="iv-role-desc">{job.description}</p>
      <div className="iv-role-foot">
        <div className="iv-role-chips">
          {shown.map((d) => (
            <span key={d} className="iv-chip">
              {d}
            </span>
          ))}
          {extra > 0 && <span className="iv-chip muted">+{extra}</span>}
        </div>
        <span className="iv-role-qcount">
          {t('interview.selectRole.questionsCount', {
            n: job._count.questions,
          })}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CandidateForm
// ---------------------------------------------------------------------------

function CandidateForm({
  candidateName,
  setCandidateName,
  cedula,
  setCedula,
  onStart,
  starting,
}: {
  candidateName: string;
  setCandidateName: (v: string) => void;
  cedula: string;
  setCedula: (v: string) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const { t } = useT();
  const canStart = candidateName.trim().length > 0 && !starting;

  return (
    <div className="iv-cand-form">
      <div className="iv-cand-head">
        <Icon
          name="user-round"
          size={15}
          style={{ color: 'var(--nai-mint-600)' }}
        />
        <span className="iv-cand-title">
          {t('interview.candidateForm.title')}
        </span>
      </div>
      <div className="iv-cand-fields">
        <label className="iv-field">
          <span className="iv-field-label">
            {t('interview.candidateForm.nameLabel')}
          </span>
          <input
            className="input"
            value={candidateName}
            placeholder={t('interview.candidateForm.namePlaceholder')}
            onChange={(e) => setCandidateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && candidateName.trim()) onStart();
            }}
            autoFocus
          />
        </label>
        <label className="iv-field">
          <span className="iv-field-label">
            {t('interview.candidateForm.cedulaLabel')}
          </span>
          <input
            className="input"
            value={cedula}
            placeholder={t('interview.candidateForm.cedulaPlaceholder')}
            onChange={(e) => setCedula(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && candidateName.trim()) onStart();
            }}
          />
        </label>
      </div>
      <div className="iv-cand-actions">
        <Button
          variant="primary"
          size="lg"
          icon={starting ? 'loader' : 'play'}
          onClick={onStart}
          disabled={!canStart}
        >
          {starting
            ? t('interview.candidateForm.starting')
            : t('interview.candidateForm.start')}
        </Button>
      </div>
    </div>
  );
}
