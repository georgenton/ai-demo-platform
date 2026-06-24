// -----------------------------------------------------------------------------
// SqlResultTable — tabla con paginación cliente simple. Muestra hasta 20
// filas iniciales con botón "ver más" hasta el LIMIT del backend (1000).
//
// Detalles UX:
//   - Header de columna sticky al hacer scroll vertical.
//   - Números con formato local (es-EC) — separadores de miles + decimales.
//   - Strings largos truncados con tooltip.
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n';

interface Props {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

const INITIAL_PAGE = 20;
const PAGE_INCREMENT = 50;

export function SqlResultTable({ columns, rows, rowCount }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const [pageSize, setPageSize] = useState(INITIAL_PAGE);

  if (columns.length === 0 || rowCount === 0) {
    return (
      <div className="bi-rows-empty">
        <span>{t('bi.rowsBlock.empty')}</span>
      </div>
    );
  }

  const shown = rows.slice(0, pageSize);

  return (
    <details
      className="bi-rows-block"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="bi-rows-summary">
        <span className="bi-rows-title">{t('bi.rowsBlock.title')}</span>
        <span className="bi-rows-count">
          {open
            ? t('bi.rowsBlock.collapse')
            : t('bi.rowsBlock.expand', { rowCount: String(rowCount) })}
        </span>
      </summary>
      <div className="bi-rows-table-wrapper">
        <table className="bi-rows-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, ri) => (
              <tr key={ri}>
                {columns.map((c, ci) => (
                  <td key={c} title={cellTitle(row[ci])}>
                    {formatCell(row[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rowCount > pageSize && (
        <div className="bi-rows-footer">
          <span className="bi-rows-hint">
            {t('bi.rowsBlock.showingFirst', {
              n: String(pageSize),
              total: String(rowCount),
            })}
          </span>
          <button
            type="button"
            className="bi-rows-more"
            onClick={() => setPageSize((s) => s + PAGE_INCREMENT)}
          >
            +{Math.min(PAGE_INCREMENT, rowCount - pageSize)}
          </button>
        </div>
      )}
    </details>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('es-EC');
  if (typeof v === 'string') {
    // Detectar números en string (Postgres devuelve Decimal así).
    if (/^-?\d+(\.\d+)?$/.test(v)) {
      const n = Number(v);
      if (Number.isFinite(n)) return n.toLocaleString('es-EC');
    }
    // ISO date corto.
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    return v;
  }
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v);
}

function cellTitle(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}
