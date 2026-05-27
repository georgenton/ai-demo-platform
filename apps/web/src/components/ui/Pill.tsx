// Pill — port TS de ui.jsx::Pill. Tag clickeable (sugerencias, dimensiones).

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from './Icon';

export interface PillProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  selected?: boolean;
  /** Nombre Lucide del icono (ej. "sparkles", "plus"). */
  icon?: string;
  children?: ReactNode;
}

export function Pill({
  selected = false,
  icon,
  children,
  className,
  ...rest
}: PillProps) {
  const cls = ['pill', selected && 'selected', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}
