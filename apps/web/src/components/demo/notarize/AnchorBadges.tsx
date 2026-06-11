// -----------------------------------------------------------------------------
// AnchorBadges — sellos generados (local y/o público) con su estado y un
// link al explorer cuando aplica.
//
// Cada sello es una card horizontal con: icono provider, título + subtítulo,
// chip de estado (confirmado / pending / failed) y, para Polygon, botón
// "Ver en el explorer".
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { AnchorSummary } from '@/lib/api';

interface Props {
  anchors: AnchorSummary[];
}

export function AnchorBadges({ anchors }: Props) {
  const { t } = useT();

  if (anchors.length === 0) return null;

  return (
    <section className="notarize-anchors">
      <h3 className="notarize-section-title">{t('notarize.anchors.title')}</h3>
      <div className="notarize-anchors-list">
        {anchors.map((a, i) => (
          <SingleAnchor key={`${a.provider}-${i}`} anchor={a} />
        ))}
      </div>
    </section>
  );
}

function SingleAnchor({ anchor }: { anchor: AnchorSummary }) {
  const { t } = useT();
  const isLocal = anchor.provider === 'local';
  const statusKey: Record<typeof anchor.status, string> = {
    confirmed: 'notarize.anchors.status.confirmed',
    pending: 'notarize.anchors.status.pending',
    failed: 'notarize.anchors.status.failed',
  };

  return (
    <div className={`notarize-anchor anchor-${anchor.status}`}>
      <div className="notarize-anchor-icon">
        <Icon name={isLocal ? 'server' : 'cloud'} size={22} strokeWidth={1.6} />
      </div>

      <div className="notarize-anchor-body">
        <div className="notarize-anchor-title">
          {t(
            isLocal
              ? 'notarize.anchors.local.title'
              : 'notarize.anchors.polygon.title',
          )}
        </div>
        <div className="notarize-anchor-subtitle">
          {t(
            isLocal
              ? 'notarize.anchors.local.subtitle'
              : 'notarize.anchors.polygon.subtitle',
          )}
        </div>
        {anchor.errorMessage && (
          <div className="notarize-anchor-error">{anchor.errorMessage}</div>
        )}
      </div>

      <div className="notarize-anchor-aside">
        <span className={`notarize-status-chip ${anchor.status}`}>
          <Icon
            name={
              anchor.status === 'confirmed'
                ? 'check'
                : anchor.status === 'pending'
                  ? 'loader'
                  : 'triangle-alert'
            }
            size={12}
          />
          {t(statusKey[anchor.status] as 'notarize.anchors.status.confirmed')}
        </span>
        {!isLocal && anchor.explorerUrl && (
          <a
            href={anchor.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="notarize-explorer-link"
          >
            <span>{t('notarize.anchors.explorerLink')}</span>
            <Icon name="external-link" size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
