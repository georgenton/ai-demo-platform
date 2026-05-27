// DocCard — item de la lista lateral de documentos. Click selecciona;
// botón papelera borra (con confirmación implícita via el optimistic
// update del hook). Class .doc-card del ui-kit.

import { Icon } from '@/components/ui';
import { formatRelative, useT } from '@/lib/i18n';
import type { DocumentSummary } from '@/lib/api';

export interface DocCardProps {
  doc: DocumentSummary;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function DocCard({ doc, selected, onSelect, onDelete }: DocCardProps) {
  const { t, lang } = useT();
  return (
    <div
      role="button"
      tabIndex={0}
      className={['doc-card', selected && 'selected'].filter(Boolean).join(' ')}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="doc-icon" aria-hidden>
        PDF
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--color-fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={doc.name}
        >
          {doc.name}
        </div>
        <div className="doc-meta">
          <span>
            {doc.chunkCount} {t('rag.doc.fragments')}
          </span>
          <span className="dot" />
          <span>{formatRelative(doc.createdAt, lang)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="theme-toggle"
        style={{ width: 26, height: 26, border: 0 }}
        aria-label={t('rag.delete')}
        title={t('rag.delete')}
      >
        <Icon name="trash-2" size={13} />
      </button>
    </div>
  );
}
