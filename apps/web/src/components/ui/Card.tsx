// Card — port TS de ui.jsx::Card. Superficie con border 1px y radius lg.
// `hover` activa la transición de borde. `flat` quita el fill (.card-flat).

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  flat?: boolean;
  children?: ReactNode;
}

export function Card({
  className,
  style,
  hover = false,
  flat = false,
  children,
  ...rest
}: CardProps) {
  const cls = ['card', hover && 'card-hover', flat && 'card-flat', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style as CSSProperties} {...rest}>
      {children}
    </div>
  );
}
