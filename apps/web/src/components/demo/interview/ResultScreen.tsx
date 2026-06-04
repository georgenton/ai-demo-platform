// -----------------------------------------------------------------------------
// Pantalla 3 — Resultado.
//
// Phase: 'finalizing' → 'finalized'. Las dimensiones llegan incrementales por
// el SSE; el panel de score global + fortalezas + oportunidades solo aparece
// cuando llega el evento `final`. El banner de auditoría (ⓘ) es OBLIGATORIO
// arriba — compromiso anti-bias del demo (ADR-0017).
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n';
import type { HrDimensionScored, UseInterviewSessionResult } from '@/lib/api';

interface Props {
  session: UseInterviewSessionResult;
  candidateName: string;
  onRestart: () => void;
}

export function ResultScreen({ session, candidateName, onRestart }: Props) {
  const { t } = useT();
  const { jobTitle, dimensions, final, phase } = session;
  const finalizing = phase === 'finalizing';

  return (
    <div className="iv-scroll">
      {/* Banner de auditoría obligatorio — compromiso anti-bias del demo */}
      <AuditBanner />

      <div className="iv-result">
        <div className="iv-result-head">
          <div className="iv-result-id">
            <div className="iv-result-name">{candidateName}</div>
            <div className="iv-result-role">
              <Icon name="briefcase" size={13} />
              {jobTitle}
            </div>
          </div>
          <div className="iv-result-rec">
            {final ? (
              <RecommendationBadge rec={final.recommendation} />
            ) : (
              <span className="iv-finalizing-pill">
                <ThinkingDots /> {t('interview.result.finalizing')}
              </span>
            )}
          </div>
        </div>

        {final && (
          <div className="iv-overall">
            <div className="iv-overall-top">
              <span className="iv-overall-label">
                {t('interview.result.overall')}
              </span>
              <span className="iv-overall-score">
                {final.overall}
                <span className="iv-overall-max">/100</span>
              </span>
            </div>
            <div className="iv-score-track">
              <div
                className={`iv-score-fill rec-${final.recommendation}`}
                style={{ width: final.overall + '%' }}
              />
            </div>
          </div>
        )}

        {finalizing && !final && (
          <p className="iv-finalizing-hint">
            {t('interview.result.finalizingHint')}
          </p>
        )}

        {dimensions.length > 0 && (
          <div className="iv-dim-section">
            <div className="iv-dim-label">
              {t('interview.result.dimensions')}
            </div>
            <div className="iv-dim-grid">
              {dimensions.map((d, i) => (
                <DimensionCard key={`${d.name}-${i}`} dimension={d} />
              ))}
            </div>
          </div>
        )}

        {final && (
          <div className="iv-prose">
            <div className="iv-prose-block">
              <div className="iv-prose-label good">
                <Icon name="trending-up" size={13} strokeWidth={2} />
                {t('interview.result.strengths')}
              </div>
              <p className="iv-prose-text">{final.strengths}</p>
            </div>
            <div className="iv-prose-block">
              <div className="iv-prose-label neutral">
                <Icon name="target" size={13} strokeWidth={2} />
                {t('interview.result.opportunities')}
              </div>
              <p className="iv-prose-text">{final.opportunities}</p>
            </div>
          </div>
        )}

        {final && (
          <div className="iv-result-actions">
            <Button
              variant="secondary"
              size="lg"
              icon="rotate-ccw"
              onClick={onRestart}
            >
              {t('interview.result.restart')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner de auditoría
// ---------------------------------------------------------------------------

function AuditBanner() {
  const { t } = useT();
  return (
    <div className="iv-audit" role="note">
      <Icon name="info" size={14} strokeWidth={2} />
      <span>{t('interview.audit.text')}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecommendationBadge — color según recomendación
// ---------------------------------------------------------------------------

const REC_LABEL_KEY: Record<'hire' | 'reconsider' | 'reject', StringKey> = {
  hire: 'interview.result.recHire',
  reconsider: 'interview.result.recReconsider',
  reject: 'interview.result.recReject',
};

const REC_ICON: Record<'hire' | 'reconsider' | 'reject', string> = {
  hire: 'circle-check',
  reconsider: 'circle-help',
  reject: 'circle-x',
};

function RecommendationBadge({
  rec,
}: {
  rec: 'hire' | 'reconsider' | 'reject';
}) {
  const { t } = useT();
  return (
    <span className={`iv-rec-badge rec-${rec}`}>
      <Icon name={REC_ICON[rec]} size={16} strokeWidth={2} />
      {t(REC_LABEL_KEY[rec])}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DimensionCard — score + barra + evidencia
// ---------------------------------------------------------------------------

/**
 * Score → tono visual del chip:
 *   0-49 → bad (crimson)
 *   50-69 → neutral (amber)
 *   70-100 → good (mint)
 *
 * Si el LLM emite scores fuera de rango (defensivo), el tono cae en `bad`
 * para que no quede invisible.
 */
function scoreToTone(score: number): 'bad' | 'neutral' | 'good' {
  if (score < 50) return 'bad';
  if (score < 70) return 'neutral';
  return 'good';
}

function DimensionCard({ dimension }: { dimension: HrDimensionScored }) {
  const tone = scoreToTone(dimension.score);
  return (
    <div className="iv-dim-card">
      <div className="iv-dim-name">{dimension.name}</div>
      <div className="iv-dim-row">
        <div className="iv-dim-track">
          <div
            className={`iv-dim-fill tone-${tone}`}
            style={{ width: dimension.score + '%' }}
          />
        </div>
        <span className={`iv-dim-score tone-${tone}`}>
          {dimension.score}
          <span className="iv-dim-max">/100</span>
        </span>
      </div>
      <p className="iv-dim-evidence">{dimension.evidence}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThinkingDots — 3 puntos pulsando (reusa la clase del clínico)
// ---------------------------------------------------------------------------

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
