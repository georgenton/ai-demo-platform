// HistoryTab — pestaña que pinta el audit log del agente (GET /agent/history).
//
// Es el "wow factor" del demo: el cliente ve TODAS las queries que el agente
// respondió, con la SQL real que generó, conteo de filas y duración.
// Demuestra confiabilidad acumulada — no es un truco de magia, hay un log.

import { Card, Icon } from '@/components/ui';
import { formatRelative, useT } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { AgentHistoryEntry } from '@/lib/api';

import { useAgentHistory } from './use-agent-history';

export function HistoryTab() {
  const { t, lang } = useT();
  const { entries, status, error, refresh } = useAgentHistory();

  if (status === 'loading' && entries.length === 0) {
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HistoryHeader />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 42, margin: '8px 14px', borderRadius: 6 }}
          />
        ))}
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card style={{ padding: 18 }}>
        <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>
          {error ?? 'Error desconocido'}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 12 }}
        >
          Reintentar
        </button>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>
          {t('agent.empty.body')}
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <HistoryHeader />
      {entries.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} lang={lang} />
      ))}
    </Card>
  );
}

function HistoryHeader() {
  const { t } = useT();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.6fr 70px 80px 100px',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--color-bg-sunken)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="eyebrow">{t('agent.history.h.question')}</div>
      <div className="eyebrow">{t('agent.history.h.sql')}</div>
      <div className="eyebrow">{t('agent.history.h.rows')}</div>
      <div className="eyebrow">{t('agent.history.h.time')}</div>
      <div className="eyebrow">{t('agent.history.h.when')}</div>
    </div>
  );
}

function HistoryRow({ entry, lang }: { entry: AgentHistoryEntry; lang: Lang }) {
  return (
    <div
      className="history-row"
      title={!entry.success ? (entry.errorMessage ?? '') : undefined}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        <Icon
          name={entry.success ? 'circle-check' : 'circle-x'}
          size={14}
          style={{
            color: entry.success
              ? 'var(--color-success)'
              : 'var(--color-danger)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.question}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--color-fg-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={entry.sql ?? ''}
      >
        {entry.sql ?? '—'}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {entry.success ? (entry.rowCount ?? '—') : '—'}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {entry.durationMs} ms
      </span>
      <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>
        {formatRelative(entry.createdAt, lang)}
      </span>
    </div>
  );
}
