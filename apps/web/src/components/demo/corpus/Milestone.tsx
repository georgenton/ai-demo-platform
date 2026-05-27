// Milestone — item del timeline de roadmap del Corpus teaser.
//
// Tres estados visuales:
//   - done       → círculo verde + check + texto en muted
//   - current    → círculo mint + texto en bold
//   - highlight  → texto en bold (para la línea "lanzamiento")
//   - (default)  → círculo gris, texto regular
//
// El kit usa una línea vertical dibujada por el wrapper padre + dots
// posicionados encima. Replicamos eso sin cambios.

import { Icon } from '@/components/ui';

export interface MilestoneProps {
  label: string;
  date: string;
  /** Marcado como completado. */
  done?: boolean;
  /** Marcado como en curso. */
  current?: boolean;
  /** Marcado como hito principal (resalta el texto). */
  highlight?: boolean;
}

export function Milestone({
  label,
  date,
  done = false,
  current = false,
  highlight = false,
}: MilestoneProps) {
  const dotBorder = done
    ? 'var(--color-success)'
    : current
      ? 'var(--color-accent)'
      : 'var(--color-border-strong)';
  const dotBg = done
    ? 'var(--color-success)'
    : current
      ? 'var(--color-accent)'
      : 'var(--color-bg)';

  const textColor = highlight
    ? 'var(--color-fg)'
    : done
      ? 'var(--color-fg-muted)'
      : 'var(--color-fg)';
  const fontWeight = highlight ? 600 : current ? 600 : 400;

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        position: 'relative',
        paddingLeft: 4,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: dotBg,
          border: '2px solid ' + dotBorder,
          flexShrink: 0,
          zIndex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        {done && (
          <Icon
            name="check"
            size={9}
            strokeWidth={3.5}
            style={{ color: 'white' }}
          />
        )}
      </span>
      <div style={{ flex: 1, fontSize: 14, color: textColor, fontWeight }}>
        {label}
      </div>
      <span className="eyebrow">{date}</span>
    </div>
  );
}
