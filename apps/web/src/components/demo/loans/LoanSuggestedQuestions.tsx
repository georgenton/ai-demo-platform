// -----------------------------------------------------------------------------
// LoanSuggestedQuestions — chips de preguntas pre-armadas para arrancar
// la conversación o avanzar el funnel.
//
// Mismo patrón que las "preguntas frecuentes" del demo clínico (Demo 06):
// el vendedor en vivo no tiene que recordar la frase exacta — clic en un
// chip y el chat avanza al siguiente stage.
//
// Las 5 sugerencias cubren los primeros tres pasos del funnel:
//   1. Identificación + monto deseado (qualification).
//   2. Cédula + ingresos (documentation).
//   3. Verificar elegibilidad (credit_evaluation).
//   4. Pregunta abierta del socio.
//   5. Resetear / nuevo socio.
//
// El callback `onPick(text)` dispara el envío al chat. Si el chat está
// streameando, los chips se deshabilitan para evitar doble envío.
// -----------------------------------------------------------------------------

'use client';

import type { StringKey } from '@/lib/i18n/strings';
import { useT } from '@/lib/i18n';

interface LoanSuggestedQuestionsProps {
  /** Si true, los chips quedan disabled (chat está streameando). */
  disabled: boolean;
  /** Callback cuando el user toca un chip — recibe el texto ya resuelto. */
  onPick: (text: string) => void;
}

/**
 * Las preguntas viven como `StringKey` para que el switch ES/EN del header
 * las traduzca. El callback recibe el texto YA en el idioma activo del
 * user — el chat no necesita saber nada de i18n.
 */
const SUGGESTIONS: ReadonlyArray<StringKey> = [
  'loans.suggested.q1',
  'loans.suggested.q2',
  'loans.suggested.q3',
  'loans.suggested.q4',
  'loans.suggested.q5',
];

export function LoanSuggestedQuestions({
  disabled,
  onPick,
}: LoanSuggestedQuestionsProps) {
  const { t } = useT();
  return (
    <div className="loan-suggested" aria-label={t('loans.suggested.title')}>
      <div className="loan-suggested-title">{t('loans.suggested.title')}</div>
      <div className="loan-suggested-list">
        {SUGGESTIONS.map((key) => {
          const text = t(key);
          return (
            <button
              key={key}
              type="button"
              className="loan-suggested-chip"
              disabled={disabled}
              onClick={() => onPick(text)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
