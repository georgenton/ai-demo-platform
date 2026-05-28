// -----------------------------------------------------------------------------
// PapersList — tabla compacta de papers del corpus con paginación.
//
// Cada fila: nombre, año, autores (primer autor + et al. si hay varios),
// tópicos como chips. Click en fila aún no hace nada (futuro: drawer con
// el abstract).
// -----------------------------------------------------------------------------

'use client';

import { useEffect } from 'react';

import { Button, Card, Eyebrow, EmptyState, Icon } from '@/components/ui';
import { useCorpusPapers, type CorpusPaperItem } from '@/lib/api';
import { useT } from '@/lib/i18n';

const PAGE_SIZE = 10;

export interface PapersListProps {
  /** Espejado para que la página padre pueda invalidar cuando hace upload. */
  refreshKey?: number;
}

export function PapersList({ refreshKey }: PapersListProps) {
  const { t } = useT();
  const { data, status, error, setQuery, refetch } = useCorpusPapers({
    limit: PAGE_SIZE,
    offset: 0,
  });

  // Si el padre cambia refreshKey (después de un upload), re-pedimos.
  // refetch es estable (useCallback en el hook), refreshKey es la trigger.
  // El primer mount también dispara una vez — aceptable porque colapsa
  // con el primer fetch que el hook ya hizo (mismos params → same query).
  useEffect(() => {
    if (refreshKey !== undefined) refetch();
  }, [refreshKey, refetch]);

  const total = data?.total ?? 0;
  const offset = data?.offset ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  function goPrev() {
    setQuery({ limit, offset: Math.max(0, offset - limit) });
  }
  function goNext() {
    setQuery({ limit, offset: offset + limit });
  }

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <Eyebrow>{t('corpus.list.title')}</Eyebrow>
        {total > 0 && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-fg-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {t('corpus.list.rangeLabel', {
              from: offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </span>
        )}
      </div>

      {status === 'loading' && !data && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--color-fg-muted)',
            fontSize: 13,
          }}
        >
          {t('corpus.list.loading')}
        </div>
      )}

      {status === 'error' && error && (
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            background: 'var(--color-danger-soft)',
            color: 'var(--color-danger)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon="library-big"
          title={t('corpus.list.emptyTitle')}
          body={t('corpus.list.emptyBody')}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: 'var(--color-border-subtle)',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {data.items.map((paper) => (
              <PaperRow key={paper.id} paper={paper} />
            ))}
          </ul>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
            }}
          >
            <Button
              variant="ghost"
              icon="chevron-left"
              onClick={goPrev}
              disabled={!hasPrev || status === 'loading'}
              size="md"
            >
              {t('corpus.list.prev')}
            </Button>
            <Button
              variant="ghost"
              iconRight="chevron-right"
              onClick={goNext}
              disabled={!hasNext || status === 'loading'}
              size="md"
            >
              {t('corpus.list.next')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

interface PaperRowProps {
  paper: CorpusPaperItem;
}

function PaperRow({ paper }: PaperRowProps) {
  const { t } = useT();

  const authorsLine =
    paper.authors.length === 0
      ? t('corpus.list.noAuthors')
      : paper.authors.length === 1
        ? paper.authors[0]
        : `${paper.authors[0]} ${t('corpus.list.etAl')}`;

  return (
    <li
      style={{
        background: 'var(--color-bg)',
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--color-fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={paper.name}
        >
          {paper.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-fg-muted)',
            marginTop: 2,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {paper.year && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--color-bg-sunken)',
                padding: '1px 6px',
                borderRadius: 3,
              }}
            >
              {paper.year}
            </span>
          )}
          <span>{authorsLine}</span>
        </div>

        {paper.topics.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            {paper.topics.slice(0, 6).map((topic) => (
              <span
                key={topic}
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: 'var(--color-accent-soft)',
                  color: 'var(--nai-mint-700)',
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      <Icon
        name="file-text"
        size={16}
        className="demo-item-icon"
        style={{ color: 'var(--color-fg-muted)' }}
      />
    </li>
  );
}
