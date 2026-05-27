// -----------------------------------------------------------------------------
// AgentEventCard — discrimina el AgentRunEvent y delega al subcomponente
// correspondiente. Renderiza:
//   - question → burbuja de usuario alineada a la derecha.
//   - thinking → ThinkingCard.
//   - sql → card con SqlBlock.
//   - result → card con badges + ResultTable.
//   - tool_error / error → card roja con el mensaje.
//   - answer → StreamingAnswer.
//   - done → row final con check verde y resumen.
// -----------------------------------------------------------------------------

import { Badge, Icon, SqlBlock } from '@/components/ui';
import { useT } from '@/lib/i18n';

import { ResultTable } from './ResultTable';
import { StreamingAnswer } from './StreamingAnswer';
import { ThinkingCard } from './ThinkingCard';
import type { AgentRunEvent } from './types';

export interface AgentEventCardProps {
  event: AgentRunEvent;
}

export function AgentEventCard({ event }: AgentEventCardProps) {
  const { t } = useT();

  switch (event.kind) {
    case 'question':
      return (
        <div
          className="materialize"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <div className="bubble user" style={{ maxWidth: '70%' }}>
            {event.text}
          </div>
        </div>
      );

    case 'thinking':
      return <ThinkingCard label={event.label} />;

    case 'sql':
      return (
        <div className="agent-event materialize">
          <div className="agent-event-head">
            <span
              className="agent-event-icon"
              style={{
                background: 'var(--nai-navy-50)',
                color: 'var(--nai-navy-700)',
              }}
            >
              <Icon name="database" size={13} strokeWidth={1.75} />
            </span>
            <span className="agent-event-kicker">{t('agent.kicker.sql')}</span>
          </div>
          <SqlBlock sql={event.sql} />
        </div>
      );

    case 'result': {
      const rowsLabel =
        event.rowCount === 1 ? t('agent.rows.one') : t('agent.rows.many');
      return (
        <div className="agent-event materialize">
          <div className="agent-event-head">
            <span
              className="agent-event-icon"
              style={{
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
              }}
            >
              <Icon name="table-2" size={13} strokeWidth={1.75} />
            </span>
            <span className="agent-event-kicker">
              {t('agent.kicker.result')}
            </span>
            <span className="spacer" />
            <Badge tone="neutral" mono>
              {event.rowCount} {rowsLabel}
            </Badge>
            <Badge tone="success" mono>
              {event.durationMs} ms
            </Badge>
          </div>
          <ResultTable rows={event.preview} />
        </div>
      );
    }

    case 'tool_error':
      return (
        <div
          className="agent-event materialize"
          style={{ borderColor: 'var(--color-danger)' }}
        >
          <div className="agent-event-head">
            <span
              className="agent-event-icon"
              style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
              }}
            >
              <Icon name="circle-x" size={13} strokeWidth={2} />
            </span>
            <span
              className="agent-event-kicker"
              style={{ color: 'var(--color-danger)' }}
            >
              {t('agent.kicker.error')}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-fg)', margin: 0 }}>
            {event.error}
          </p>
        </div>
      );

    case 'answer':
      return <StreamingAnswer text={event.text} streaming={event.streaming} />;

    case 'done': {
      const turnsLabel =
        event.turns === 1 ? t('agent.turns.one') : t('agent.turns.many');
      return (
        <div
          className="materialize row"
          style={{
            gap: 8,
            fontSize: 13,
            color: 'var(--color-fg-muted)',
            padding: '4px 2px',
          }}
        >
          <Icon
            name="circle-check"
            size={15}
            style={{ color: 'var(--color-success)' }}
          />
          <span>{t('agent.done', { n: event.turns, turns: turnsLabel })}</span>
        </div>
      );
    }

    case 'error':
      return (
        <div
          className="agent-event materialize"
          style={{ borderColor: 'var(--color-danger)' }}
        >
          <div className="agent-event-head">
            <span
              className="agent-event-icon"
              style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
              }}
            >
              <Icon name="circle-x" size={13} strokeWidth={2} />
            </span>
            <span
              className="agent-event-kicker"
              style={{ color: 'var(--color-danger)' }}
            >
              {t('agent.kicker.error')}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-fg)', margin: 0 }}>
            {event.message}
          </p>
        </div>
      );

    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return null;
    }
  }
}
