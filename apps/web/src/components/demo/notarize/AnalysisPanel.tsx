// -----------------------------------------------------------------------------
// AnalysisPanel — el "qué encontró la IA" del documento. Tres bloques:
//   1. Dimensiones extraídas (tabla 2 columnas: label → value).
//   2. Riesgos detectados (cards con chip de severity + título + descripción).
//   3. Recomendaciones (lista bullets).
//
// Si analysis es null (el LLM falló), mostramos un estado vacío con el
// mensaje correspondiente.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { DocumentAnalysis, RiskSeverity } from '@/lib/api';

interface Props {
  analysis: DocumentAnalysis | null;
}

const SEVERITY_KEY: Record<RiskSeverity, string> = {
  high: 'notarize.risk.high',
  medium: 'notarize.risk.medium',
  low: 'notarize.risk.low',
  info: 'notarize.risk.info',
};

const SEVERITY_ICON: Record<RiskSeverity, string> = {
  high: 'triangle-alert',
  medium: 'alert-circle',
  low: 'info',
  info: 'info',
};

export function AnalysisPanel({ analysis }: Props) {
  const { t } = useT();

  if (!analysis) {
    return (
      <section className="notarize-analysis empty">
        <h3 className="notarize-section-title">
          {t('notarize.analysis.title')}
        </h3>
        <div className="notarize-analysis-empty">
          <Icon name="info" size={18} />
          <span>{t('notarize.analysis.empty')}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="notarize-analysis">
      <h3 className="notarize-section-title">{t('notarize.analysis.title')}</h3>

      {/* Dimensiones */}
      <div className="notarize-block">
        <div className="notarize-block-title">
          {t('notarize.analysis.dimensions')}
        </div>
        <dl className="notarize-dim-list">
          {analysis.dimensions.map((d) => (
            <div key={d.key} className="notarize-dim-row">
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Riesgos */}
      <div className="notarize-block">
        <div className="notarize-block-title">
          {t('notarize.analysis.risks')}
        </div>
        {analysis.risks.length === 0 ? (
          <div className="notarize-block-empty">
            {t('notarize.analysis.noRisks')}
          </div>
        ) : (
          <div className="notarize-risk-list">
            {analysis.risks.map((r, i) => (
              <div key={i} className={`notarize-risk ${r.severity}`}>
                <span className={`notarize-risk-chip ${r.severity}`}>
                  <Icon name={SEVERITY_ICON[r.severity]} size={12} />
                  {t(SEVERITY_KEY[r.severity] as 'notarize.risk.high')}
                </span>
                <div className="notarize-risk-body">
                  <div className="notarize-risk-title">{r.title}</div>
                  <div className="notarize-risk-description">
                    {r.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recomendaciones */}
      {analysis.recommendations.length > 0 && (
        <div className="notarize-block">
          <div className="notarize-block-title">
            {t('notarize.analysis.recommendations')}
          </div>
          <ul className="notarize-reco-list">
            {analysis.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
