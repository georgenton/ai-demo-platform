// -----------------------------------------------------------------------------
// TotalPapersCard — número grande con label. Densidad mínima, alta jerarquía
// visual para el hero de stats.
// -----------------------------------------------------------------------------

'use client';

import { Card, Eyebrow, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

export interface TotalPapersCardProps {
  total: number;
  loading?: boolean;
}

export function TotalPapersCard({ total, loading }: TotalPapersCardProps) {
  const { t } = useT();
  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 220,
      }}
    >
      <Eyebrow>{t('corpus.stats.total')}</Eyebrow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--color-accent-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--nai-mint-700)',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <Icon name="library-big" size={24} strokeWidth={1.7} />
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: loading ? 'var(--color-fg-muted)' : 'var(--color-fg)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '—' : total}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--color-fg-muted)',
          lineHeight: 1.4,
        }}
      >
        {t('corpus.stats.totalHelp')}
      </div>
    </Card>
  );
}
