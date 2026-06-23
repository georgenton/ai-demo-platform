// -----------------------------------------------------------------------------
// LeadCard — tarjeta de un lead dentro de una columna del kanban. Click
// abre el LeadDetailDrawer con el detalle completo.
// -----------------------------------------------------------------------------

'use client';

import type { LoanLeadListItem } from '@/lib/api';

interface Props {
  lead: LoanLeadListItem;
  selected?: boolean;
  onSelect: (lead: LoanLeadListItem) => void;
}

export function LeadCard({ lead, selected = false, onSelect }: Props) {
  const monto = lead.requestedAmount ? `$${lead.requestedAmount}` : '—';
  const plazo = lead.termMonths ? `${lead.termMonths}m` : '—';
  const updatedAgo = formatRelativeTime(lead.updatedAt);

  return (
    <button
      type="button"
      className={`funnel-lead-card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(lead)}
      aria-label={`Lead ${lead.fullName || 'sin nombre'}`}
    >
      <div className="funnel-lead-card-name">
        {lead.fullName || '(sin nombre)'}
      </div>
      <div className="funnel-lead-card-meta">
        <span className="funnel-lead-card-amount">{monto}</span>
        <span className="funnel-lead-card-dot">·</span>
        <span className="funnel-lead-card-term">{plazo}</span>
      </div>
      <div className="funnel-lead-card-footer">
        <span className="funnel-lead-card-time">{updatedAgo}</span>
        {lead.lastStageReason && (
          <span
            className="funnel-lead-card-reason"
            title={lead.lastStageReason}
          >
            {lead.lastStageReason.slice(0, 40)}
            {lead.lastStageReason.length > 40 ? '…' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Formato relativo simple — "ahora", "hace 5m", "hace 3h", "hace 2d".
 * No usamos Intl.RelativeTimeFormat para evitar añadir dependencia y
 * mantener output determinístico en SSR.
 */
function formatRelativeTime(iso: string): string {
  const updated = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - updated) / 1000));
  if (diffSec < 30) return 'ahora';
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `hace ${diffD}d`;
}
