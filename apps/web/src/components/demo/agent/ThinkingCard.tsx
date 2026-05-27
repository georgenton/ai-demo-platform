// ThinkingCard — placeholder mientras esperamos el primer evento del backend
// (entre que mandamos la pregunta y el LLM empieza a emitir tokens o tools).
//
// Diferencia con ThinkingBubble (Demo RAG): acá es una CARD (.agent-event)
// del shape de la consola del agente, no una burbuja de chat.

import { Icon, ThinkingDots } from '@/components/ui';
import { useT } from '@/lib/i18n';

export interface ThinkingCardProps {
  /** Texto del label. Si se omite, fallback al string i18n por defecto. */
  label?: string;
}

export function ThinkingCard({ label }: ThinkingCardProps) {
  const { t } = useT();
  return (
    <div className="agent-event materialize">
      <div className="agent-event-head">
        <span
          className="agent-event-icon"
          style={{
            background: 'var(--color-warn-bg)',
            color: 'var(--nai-amber-700)',
          }}
        >
          <Icon name="brain" size={13} strokeWidth={1.75} />
        </span>
        <span className="agent-event-kicker">{t('agent.kicker.thinking')}</span>
      </div>
      <div className="row" style={{ gap: 10, fontSize: 13 }}>
        <ThinkingDots />
        <span style={{ color: 'var(--color-fg-muted)' }}>
          {label ?? t('agent.thinking.default')}
        </span>
      </div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div className="skeleton" style={{ height: 10, width: '78%' }} />
        <div className="skeleton" style={{ height: 10, width: '62%' }} />
      </div>
    </div>
  );
}
