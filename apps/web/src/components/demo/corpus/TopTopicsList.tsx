// -----------------------------------------------------------------------------
// TopTopicsList — top N tópicos del corpus con barra horizontal de
// frecuencia. Densidad alta, sin chart pesado — la barra es solo un
// `<div>` width proporcional al max.
// -----------------------------------------------------------------------------

'use client';

import { Card, Eyebrow } from '@/components/ui';
import type { TopTopicItem } from '@/lib/api';
import { useT } from '@/lib/i18n';

export interface TopTopicsListProps {
  data: TopTopicItem[];
}

export function TopTopicsList({ data }: TopTopicsListProps) {
  const { t } = useT();
  const maxCount = data.reduce((acc, it) => Math.max(acc, it.count), 0);

  return (
    <Card style={{ minHeight: 220 }}>
      <Eyebrow>{t('corpus.chart.topTopics')}</Eyebrow>

      {data.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 160,
            color: 'var(--color-fg-muted)',
            fontSize: 13,
          }}
        >
          {t('corpus.chart.empty')}
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '12px 0 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {data.slice(0, 8).map((item) => {
            const widthPct =
              maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
            return (
              <li
                key={item.topic}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    background: 'var(--color-bg-sunken)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    height: 24,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${widthPct}%`,
                      background: 'var(--color-accent-soft)',
                      transition: 'width 200ms ease',
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      padding: '4px 8px',
                      display: 'inline-block',
                      color: 'var(--color-fg)',
                    }}
                  >
                    {item.topic}
                  </span>
                </div>
                <span
                  style={{
                    color: 'var(--color-fg-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    minWidth: 28,
                    textAlign: 'right',
                  }}
                >
                  {item.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
