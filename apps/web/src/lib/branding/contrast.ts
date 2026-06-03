// =============================================================================
// contrast.ts — guarda de contraste WCAG para el accentColor del tenant.
//
// Port directo (1:1) de los mockups del refinamiento multi-tenant
// (docs/design/handoffs/multi-tenant-frontend-refinement.md, sección "Pieza 4").
// Fórmula estándar WCAG 2.x: luminancia relativa + ratio de contraste.
//
// POLÍTICA (confirmada en handoff): estricta theme-aware. El accentColor del
// tenant debe pasar AA contra el fondo del sidebar en LIGHT *y* DARK. El
// accent es un elemento gráfico (rail/borde/ring), así que el criterio es
// **WCAG 1.4.11 Non-text Contrast = 3:1** (sigue siendo AA — no es texto, no
// aplica el umbral 4.5:1 de WCAG 1.4.3). Si falla en cualquiera de los dos
// temas, cae al fallback (mint-600). Un solo check, sin listener al cambio
// de tema — branding predecible y consistente entre temas.
//
// Por qué el fallback es mint-600 y no el mint-500 default del producto:
// el mint-500 (#43C194) NO pasa 3:1 contra el fondo claro del sidebar
// (2.11:1). No puede ser el fallback de su propio test. Mint-600 (#2E9A72)
// pasa ambos temas (3.28 claro / 5.58 oscuro) y mantiene la identidad
// verde NAI. Esto NO cambia el --color-accent default del producto; solo
// aplica cuando el accent del tenant falla la guarda.
//
// Uso en el sidebar:
//   const accent = resolveAccentStrict(branding.accentColor);
// Uso en el admin (warning inline):
//   const ev = evaluateAccent(hex);
//   if (!ev.ok) warn(`falla en tema ${ev.failing}`);
// =============================================================================

/** Color RGB con canales 0–255. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Resultado de evaluar el contraste contra ambos temas. */
export interface ContrastEvaluation {
  /** True si pasa AA non-text (3:1) contra los fondos en light Y dark. */
  ok: boolean;
  /** True si pasa AA non-text contra el fondo light. */
  light: boolean;
  /** True si pasa AA non-text contra el fondo dark. */
  dark: boolean;
  /** Tema donde falla primero, o null si pasa en ambos. */
  failing: 'light' | 'dark' | null;
}

/** Pareja de fondos para evaluar contraste — uno por tema. */
export interface SidebarBackgrounds {
  light: string;
  dark: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Umbral WCAG 1.4.11 (Non-text Contrast) — el accent del tenant en el sidebar
 * se renderiza como elemento gráfico (rail de 3px del item activo, bordes,
 * ring de foco), NO como texto. Por eso aplica este criterio (3:1) y no el
 * 1.4.3 Contrast (Minimum) que es 4.5:1 y aplica solo a texto.
 */
export const AA_NONTEXT = 3.0;

/**
 * Fondos del sidebar (`--color-bg-sunken` en `tokens.css`) en cada tema. El
 * sidebar se renderiza en light Y dark, así que la política estricta exige
 * pasar contra AMBOS fondos.
 */
export const SIDEBAR_BG: SidebarBackgrounds = {
  light: '#f6f7f9',
  dark: '#060c17',
};

/**
 * Fallback cuando el accent del tenant no pasa la guarda. Es `--nai-mint-600`,
 * NO `mint-500`. Ver header del archivo para la razón.
 */
export const FALLBACK_ACCENT = '#2e9a72';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Parsea `#RGB` o `#RRGGBB` → RGB, o `null` si no es válido. */
export function hexToRgb(hex: string): RGB | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  // Forma corta #abc → #aabbcc.
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Luminancia relativa de un canal individual (0–255 → 0–1). Fórmula WCAG. */
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa de un color RGB. Coefficientes sRGB. */
function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Ratio de contraste WCAG entre dos colores hex (1–21). Devuelve 0 si alguno
 * no parsea.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 0;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** ¿Pasa AA non-text (3:1) contra el fondo dado? */
export function passesAA(candidate: string, bg: string): boolean {
  return contrastRatio(candidate, bg) >= AA_NONTEXT;
}

/**
 * Política estricta theme-aware: ¿el accent pasa AA contra el fondo del
 * sidebar en AMBOS temas? Devuelve `{ ok, light, dark, failing }`. `failing`
 * es el primer tema donde falla, o null si pasa en los dos.
 */
export function evaluateAccent(
  candidate: string,
  bg: SidebarBackgrounds = SIDEBAR_BG,
): ContrastEvaluation {
  const lightOk = contrastRatio(candidate, bg.light) >= AA_NONTEXT;
  const darkOk = contrastRatio(candidate, bg.dark) >= AA_NONTEXT;
  return {
    ok: lightOk && darkOk,
    light: lightOk,
    dark: darkOk,
    failing: lightOk ? (darkOk ? null : 'dark') : 'light',
  };
}

/**
 * Resuelve el accent a aplicar bajo la política estricta. Si el accent del
 * tenant NO pasa AA en ambos temas, cae a `fallback` (mint-600 por default).
 * Un solo check, sin listener al cambio de tema — el branding es predecible
 * y consistente entre temas.
 *
 * Si `candidate` es null/undefined/empty, también devuelve el fallback (caso
 * del tenant sin branding custom).
 */
export function resolveAccentStrict(
  candidate: string | null | undefined,
  fallback: string = FALLBACK_ACCENT,
  bg: SidebarBackgrounds = SIDEBAR_BG,
): string {
  if (!candidate) return fallback;
  return evaluateAccent(candidate, bg).ok ? candidate : fallback;
}
