// EmptyState — port TS de ui.jsx::EmptyState. Hero del "todavía no hay nada"
// con icono opcional, título, body y CTA opcional. Class .empty-state.

import type { ReactNode } from 'react';

import { Icon } from './Icon';

export interface EmptyStateProps {
  /** Nombre Lucide del icono del header (ej. "bot", "file-search"). */
  icon?: string;
  title: ReactNode;
  body?: ReactNode;
  /** CTA opcional (suele ser un <Button />). */
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-fg-muted)',
          }}
        >
          <Icon name={icon} size={26} strokeWidth={1.4} />
        </div>
      )}
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
