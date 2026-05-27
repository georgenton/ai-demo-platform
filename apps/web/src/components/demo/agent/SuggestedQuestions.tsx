// SuggestedQuestions — columna izquierda de la consola del agente.
// Cards clickeables que disparan una pregunta al hacer click.
//
// A diferencia del Demo RAG (donde las sugerencias solo prellenan el
// input), acá DISPARAN el run directo — es lo que el kit hace, y le da al
// presentador un click rápido durante la demo.

import { Eyebrow, Icon } from '@/components/ui';
import { SUGGESTED_QUESTIONS_I18N, useT } from '@/lib/i18n';

export interface SuggestedQuestionsProps {
  /** Lo que se ejecuta al hacer click en una sugerencia. */
  onPick: (question: string) => void;
  /** Si true, los botones se deshabilitan (durante un run en curso). */
  disabled?: boolean;
}

export function SuggestedQuestions({
  onPick,
  disabled = false,
}: SuggestedQuestionsProps) {
  const { t, lang } = useT();
  const questions = SUGGESTED_QUESTIONS_I18N[lang];

  return (
    <aside className="col" style={{ gap: 14, minHeight: 0 }}>
      <Eyebrow>{t('agent.suggested')}</Eyebrow>
      <div className="col" style={{ gap: 6 }}>
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            className="card card-hover"
            onClick={() => onPick(q)}
            disabled={disabled}
            style={{
              textAlign: 'left',
              font: 'inherit',
              color: 'var(--color-fg)',
              padding: '10px 12px',
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              lineHeight: 1.45,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Icon
              name="sparkles"
              size={13}
              style={{
                color: 'var(--color-accent)',
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
