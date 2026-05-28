// -----------------------------------------------------------------------------
// TutorFeedbackPanel — Panel 2 del Demo 05.
//
// Muestra el último "💡 Tip: ..." que el tutor agregó al final de su mensaje.
// Si el tutor no corrigió nada en el último turn, mostramos un estado vacío
// que dice "Sin correcciones — ¡bien hecho!".
//
// Implementación: el helper `extractTip` aísla la parte después del prefix.
// Buscamos el ÚLTIMO mensaje del asistente en el history (el más reciente
// con tip extraíble).
// -----------------------------------------------------------------------------

'use client';

import { Card, EmptyState, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { TutorHistoryTurn } from '@/lib/api';

import { extractTip } from './extract-tip';

export interface TutorFeedbackPanelProps {
  history: TutorHistoryTurn[];
}

export function TutorFeedbackPanel({ history }: TutorFeedbackPanelProps) {
  const { t } = useT();
  const lastTip = findLastTip(history);

  if (!lastTip) {
    return (
      <Card style={{ padding: 0, height: '100%', minHeight: 220 }}>
        <div style={{ padding: 18, height: '100%' }}>
          <EmptyState
            icon="message-square-text"
            title={t('tutor.feedback.empty.title')}
            body={t('tutor.feedback.empty.body')}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, height: '100%', minHeight: 220 }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon name="lightbulb" size={16} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {t('tutor.feedback.lastTip')}
        </span>
      </div>
      <div
        style={{
          padding: 16,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--color-fg)',
        }}
      >
        {lastTip}
      </div>
    </Card>
  );
}

/** Recorre el history en reverso y devuelve el tip del último assistant que tenga uno. */
function findLastTip(history: TutorHistoryTurn[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const { tip } = extractTip(turn.content);
    if (tip) return tip;
  }
  return null;
}
