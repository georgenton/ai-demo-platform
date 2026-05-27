// Badge — port TS de ui.jsx::Badge. Pillito de estado (.badge-success,
// .badge-warn, .badge-danger, .badge-info, .badge-neutral) con icono opcional.

import type { ReactNode } from 'react';

import { Icon } from './Icon';

type BadgeTone = 'success' | 'warn' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Nombre Lucide (kebab-case) del icono. */
  icon?: string;
  /** Si true, usa font-mono (.badge-mono). Útil para counts/durations. */
  mono?: boolean;
  children?: ReactNode;
}

export function Badge({
  tone = 'neutral',
  icon,
  mono = false,
  children,
}: BadgeProps) {
  const cls = ['badge', `badge-${tone}`, mono && 'badge-mono']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls}>
      {icon && <Icon name={icon} size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}
