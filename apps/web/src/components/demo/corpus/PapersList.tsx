// -----------------------------------------------------------------------------
// PapersList — tabla compacta de papers del corpus con paginación.
//
// Cada fila: nombre, año, autores (primer autor + et al. si hay varios),
// tópicos como chips, y botón de eliminar a la derecha. El delete usa
// optimistic UI local + refetch tras la confirmación del backend.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState, type MouseEvent } from 'react';

import { Button, Card, Eyebrow, EmptyState, Icon } from '@/components/ui';
import {
  ApiError,
  deleteDocument,
  useCorpusPapers,
  type CorpusPaperItem,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

const PAGE_SIZE = 10;

export interface PapersListProps {
  /** Espejado para que la página padre pueda invalidar cuando hace upload. */
  refreshKey?: number;
  /**
   * Callback que se dispara cuando el usuario borra un paper de la lista.
   * La página padre lo usa para invalidar las stats (total, charts) que
   * viven en un hook distinto.
   */
  onPaperDeleted?: () => void;
}

export function PapersList({ refreshKey, onPaperDeleted }: PapersListProps) {
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
              <PaperRow
                key={paper.id}
                paper={paper}
                onDeleted={() => {
                  // Tras un delete exitoso refrescamos la lista local
                  // y notificamos al padre para que invalide las stats
                  // (total, papersByYear, topTopics). Si el delete
                  // falla, PaperRow restaura el estado y muestra error
                  // inline.
                  refetch();
                  onPaperDeleted?.();
                }}
              />
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
  /** Notifica al padre tras un delete exitoso para que invalide la lista. */
  onDeleted: () => void;
}

function PaperRow({ paper, onDeleted }: PaperRowProps) {
  const { t } = useT();
  const [deleting, setDeleting] = useState(false);
  // `removed` = optimistic UI: ocultamos la fila localmente apenas el
  // usuario clickea. Si el backend falla, restauramos.
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorsLine =
    paper.authors.length === 0
      ? t('corpus.list.noAuthors')
      : paper.authors.length === 1
        ? paper.authors[0]
        : `${paper.authors[0]} ${t('corpus.list.etAl')}`;

  async function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    setRemoved(true);
    setError(null);
    try {
      await deleteDocument(paper.id);
      onDeleted();
    } catch (err) {
      // Restauramos la fila para que el usuario vea el error en contexto.
      setRemoved(false);
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);

      console.warn(`Falló delete de "${paper.name}":`, message);
    } finally {
      setDeleting(false);
    }
  }

  if (removed) return null;

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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={t('rag.delete')}
          title={t('rag.delete')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 6,
            margin: 0,
            borderRadius: 6,
            cursor: deleting ? 'default' : 'pointer',
            color: 'var(--color-fg-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: deleting ? 0.5 : 1,
            transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            if (deleting) return;
            e.currentTarget.style.background = 'var(--color-danger-soft)';
            e.currentTarget.style.color = 'var(--color-danger)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-fg-muted)';
          }}
        >
          <Icon name="trash-2" size={16} strokeWidth={1.7} />
        </button>
        {error && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-danger)',
              maxWidth: 180,
              textAlign: 'right',
            }}
          >
            {error}
          </span>
        )}
      </div>
    </li>
  );
}
