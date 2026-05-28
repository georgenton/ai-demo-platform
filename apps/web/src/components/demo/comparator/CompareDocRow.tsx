// CompareDocRow — variante de DocCard con checkbox para selección múltiple
// en el wizard del comparator. El check usa mint cuando activo (consistente
// con el accent del kit).
//
// Nota sobre la estructura DOM:
//   El row entero era originalmente un <button> (toda la fila clickeable
//   para hacer toggle). Para sumar el botón "Eliminar" cambiamos a un
//   <div> con un <button> interno para el toggle y otro <button> separado
//   para el delete. HTML no permite anidar <button> dentro de <button>.

import { type MouseEvent } from 'react';

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
  /**
   * Callback opcional para borrar el documento. Si está presente,
   * renderizamos un botón X a la derecha del row. Si no, el row se
   * comporta como antes (sin opción de delete).
   */
  onDelete?: () => void;
}

export function CompareDocRow({
  doc,
  selected,
  onToggle,
  disabled = false,
  onDelete,
}: CompareDocRowProps) {
  const { t, lang } = useT();

  function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    // Evitamos que el click del delete dispare el toggle del row.
    e.stopPropagation();
    onDelete?.();
  }

  return (
    <div
      className={['doc-card', selected && 'selected'].filter(Boolean).join(' ')}
      style={{
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={selected ? t('common.remove') : doc.name}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'contents',
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

      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label={t('rag.delete')}
          title={t('rag.delete')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 6,
            margin: 0,
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--color-fg-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
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
      )}
    </div>
  );
}
