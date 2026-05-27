// CompareDocRow — variante de DocCard con checkbox para selección múltiple
// en el wizard del comparator. El check usa mint cuando activo (consistente
// con el accent del kit).

import { Icon } from '@/components/ui';
import { formatRelative, useT } from '@/lib/i18n';
import type { DocumentSummary } from '@/lib/api';

export interface CompareDocRowProps {
  doc: DocumentSummary;
  selected: boolean;
  onToggle: () => void;
  /**
   * Si true, deshabilitamos el toggle. Útil cuando el usuario ya alcanzó
   * el tope de 5 selecciones y este doc no está entre los elegidos.
   */
  disabled?: boolean;
}

export function CompareDocRow({
  doc,
  selected,
  onToggle,
  disabled = false,
}: CompareDocRowProps) {
  const { t, lang } = useT();
  return (
    <button
      type="button"
      className={['doc-card', selected && 'selected'].filter(Boolean).join(' ')}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border:
            '1.5px solid ' +
            (selected ? 'var(--nai-mint-500)' : 'var(--color-border-strong)'),
          background: selected ? 'var(--nai-mint-500)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {selected && (
          <Icon
            name="check"
            size={12}
            strokeWidth={3}
            style={{ color: 'var(--nai-navy-900)' }}
          />
        )}
      </span>
      <div className="doc-icon" style={{ width: 32, height: 38 }} aria-hidden>
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
    </button>
  );
}
