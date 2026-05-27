// Eyebrow — port TS de ui.jsx::Eyebrow. KICKER mono uppercase con dot opcional.

import type { CSSProperties, ReactNode } from 'react';

export interface EyebrowProps {
  /** Si true, render de un dot 6px del color actual a la izquierda. */
  dot?: boolean;
  /** Override del color. Por default usa --color-fg-muted. */
  color?: string;
  children?: ReactNode;
}

export function Eyebrow({ dot = false, color, children }: EyebrowProps) {
  const style: CSSProperties = {
    color: color || 'var(--color-fg-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };
  return (
    <div className="eyebrow" style={style}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
          }}
        />
      )}
      {children}
    </div>
  );
}
