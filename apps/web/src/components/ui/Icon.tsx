// -----------------------------------------------------------------------------
// Icon — wrapper de lucide-react que acepta el nombre "kebab-case" que usa
// el handoff (data-lucide="upload-cloud") y lo resuelve al componente
// PascalCase que exporta `lucide-react` (UploadCloud).
//
// Por qué el indirección: el design kit JSX usa `<Icon name="upload-cloud" />`
// vía data-attribute + CDN script. En React real con tree-shaking,
// importamos los componentes directamente. Pero queremos preservar la API
// `name="..."` para que el port sea 1:1 con el kit y los strings de los
// componentes sean idénticos al handoff.
//
// Iconos no encontrados:
//   - En dev: warn + render de un placeholder visible (cuadrado vacío),
//     así notamos un typo antes de pasarlo al cliente.
//   - En prod: render del placeholder silencioso (no rompemos).
// -----------------------------------------------------------------------------

import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export interface IconProps {
  /** Nombre kebab-case (mismo que data-lucide del kit). */
  name: string;
  /** Tamaño en px. Default 16. */
  size?: number;
  /** Stroke width Lucide. Default 1.5 (design system). */
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
}

/**
 * Convierte "upload-cloud" → "UploadCloud" (PascalCase). Lucide exporta
 * sus componentes así.
 */
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Cache name → component para evitar re-buscar en LucideIcons en cada render.
 * Map global, vive lo que dure el bundle.
 */
const cache = new Map<string, LucideIcon | null>();

function resolveIcon(name: string): LucideIcon | null {
  if (cache.has(name)) return cache.get(name) ?? null;
  const componentName = toPascalCase(name);
  // LucideIcons exporta cada icono como named export. Desde lucide-react
  // ~v0.300 los iconos son objetos `forwardRef` (no functions), así que
  // `typeof === 'function'` no alcanza — chequeamos también `object` no-null
  // para aceptar forwardRef/memo. El lookup solo encuentra componentes
  // (lucide no exporta otras cosas runtime), así que el riesgo de aceptar
  // un objeto raro es nulo.
  const lookup = (LucideIcons as unknown as Record<string, unknown>)[
    componentName
  ];
  const isComponent =
    lookup != null &&
    (typeof lookup === 'function' || typeof lookup === 'object');
  const resolved = isComponent ? (lookup as LucideIcon) : null;
  cache.set(name, resolved);
  return resolved;
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.5,
  className,
  style,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  const Component = resolveIcon(name);

  if (!Component) {
    // En dev, gritar al console para que se note el typo. En prod, render
    // de un placeholder neutro (cuadrado del tamaño correcto, sin contenido).
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Icon] No se encontró el icono "${name}" en lucide-react. ` +
          `¿Está bien el name? (esperado kebab-case: "upload-cloud", ` +
          `"chevron-right"…)`,
      );
    }
    return (
      <span
        aria-hidden={ariaHidden}
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          ...style,
        }}
      />
    );
  }

  return (
    <Component
      className={className}
      style={style}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
    />
  );
}
