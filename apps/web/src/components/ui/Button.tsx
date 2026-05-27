// Button — port TS de ui.jsx::Button.
// Las clases (.btn, .btn-primary, etc.) vienen de ui-kit.css.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from './Icon';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Nombre Lucide (kebab-case) del icono a la izquierda. */
  icon?: string;
  /** Nombre Lucide del icono a la derecha (ej. "arrow-right" en CTAs). */
  iconRight?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  className,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'lg' && 'btn-lg',
    size === 'sm' && 'btn-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'lg' ? 18 : 16;

  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
