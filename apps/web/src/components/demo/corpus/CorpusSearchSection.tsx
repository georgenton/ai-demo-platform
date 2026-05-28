// -----------------------------------------------------------------------------
// CorpusSearchSection — input semántico + respuesta streameada.
//
// Usa useCorpusSearch(). Patrón análogo al chat del RAG pero más simple:
// no hay history persistente, cada query reemplaza la respuesta anterior.
// -----------------------------------------------------------------------------

'use client';

import { useState, type FormEvent } from 'react';

import { Button, Card, Eyebrow, Icon } from '@/components/ui';
import { useCorpusSearch } from '@/lib/api';
import { useT } from '@/lib/i18n';

export interface CorpusSearchSectionProps {
  /** Sugerencia opcional (precarga el input cuando el user clickea una). */
  suggested?: string[];
  disabled?: boolean;
}

export function CorpusSearchSection({
  suggested = [],
  disabled,
}: CorpusSearchSectionProps) {
  const { t } = useT();
  const [input, setInput] = useState('');
  const { text, status, error, start } = useCorpusSearch();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || status === 'streaming') return;
    start({ q });
  }

  return (
    <Card>
      <Eyebrow>{t('corpus.search.title')}</Eyebrow>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-fg-muted)',
          margin: '4px 0 12px 0',
          lineHeight: 1.5,
        }}
      >
        {t('corpus.search.desc')}
      </p>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('corpus.search.placeholder')}
          disabled={disabled || status === 'streaming'}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border-strong)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
          }}
        />
        <Button
          type="submit"
          variant="accent"
          icon="search"
          disabled={
            disabled || status === 'streaming' || input.trim().length === 0
          }
        >
          {status === 'streaming'
            ? t('corpus.search.searching')
            : t('corpus.search.submit')}
        </Button>
      </form>

      {suggested.length > 0 && status === 'idle' && !text && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {suggested.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="pill"
              style={{ cursor: 'pointer' }}
            >
              <Icon name="sparkles" size={12} />
              {s}
            </button>
          ))}
        </div>
      )}

      {(text || status === 'streaming') && (
        <div
          style={{
            padding: 14,
            borderRadius: 6,
            background: 'var(--color-bg-sunken)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            color: 'var(--color-fg)',
            minHeight: 60,
          }}
        >
          {text ||
            (status === 'streaming' ? t('corpus.search.thinking') : null)}
        </div>
      )}

      {status === 'error' && error && (
        <div
          style={{
            marginTop: 12,
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
    </Card>
  );
}
