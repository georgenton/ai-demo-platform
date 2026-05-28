// -----------------------------------------------------------------------------
// CorpusSummarySection — botón "Generar resumen" + área de markdown
// streameado del map-reduce LLM.
//
// El botón solo se habilita si totalPapers >= 3 (el backend lo enforce
// también, pero anticipamos la UX para no mostrar "el corpus tiene solo X"
// cada vez).
// -----------------------------------------------------------------------------

'use client';

import { Button, Card, Eyebrow, Icon } from '@/components/ui';
import { useCorpusSummary } from '@/lib/api';
import { useT } from '@/lib/i18n';

export interface CorpusSummarySectionProps {
  totalPapers: number;
}

/** Mínimo de papers que el backend considera "corpus suficiente" para
 *  resumir. Espejo del MIN_PAPERS_FOR_SUMMARY del CorpusSummaryService. */
const MIN_PAPERS = 3;

export function CorpusSummarySection({
  totalPapers,
}: CorpusSummarySectionProps) {
  const { t } = useT();
  const { text, status, error, start, reset } = useCorpusSummary();

  const tooFew = totalPapers < MIN_PAPERS;
  const busy = status === 'streaming';

  return (
    <Card>
      <Eyebrow>{t('corpus.summary.title')}</Eyebrow>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-fg-muted)',
          margin: '4px 0 12px 0',
          lineHeight: 1.5,
        }}
      >
        {t('corpus.summary.desc')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button
          variant="accent"
          icon="sparkles"
          onClick={start}
          disabled={busy || tooFew}
        >
          {busy ? t('corpus.summary.generating') : t('corpus.summary.generate')}
        </Button>
        {(text || status === 'error') && !busy && (
          <Button variant="ghost" onClick={reset} icon="rotate-ccw">
            {t('corpus.summary.reset')}
          </Button>
        )}
      </div>

      {tooFew && (
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            background: 'var(--color-bg-sunken)',
            color: 'var(--color-fg-muted)',
            fontSize: 13,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <Icon name="info" size={14} />
          {t('corpus.summary.tooFew', { min: MIN_PAPERS })}
        </div>
      )}

      {(text || busy) && (
        <div
          style={{
            padding: 14,
            borderRadius: 6,
            background: 'var(--color-bg-sunken)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            color: 'var(--color-fg)',
            minHeight: 100,
          }}
        >
          {text || (busy ? t('corpus.summary.thinking') : null)}
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
