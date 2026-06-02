// -----------------------------------------------------------------------------
// theme-helpers.ts — funciones puras de la lógica de selección de theme.
//
// El ThemeProvider las consume; vivirlas afuera nos permite testearlas
// sin renderizar React (no tenemos jsdom en el proyecto, y agregarlo solo
// para esto es over-engineering).
//
// Política (PR-MT7-prep):
//   1) Si hay valor en localStorage → respetar la elección del usuario.
//   2) Si no → seguir al sistema operativo (prefers-color-scheme).
//   3) Si todo falla (SSR, sandbox) → fallback light.
// -----------------------------------------------------------------------------

export type Theme = 'light' | 'dark';

/** Fallback final cuando todo falla. Light es más seguro institucionalmente. */
export const FALLBACK_THEME: Theme = 'light';

/** Key de localStorage donde persistimos la elección manual del usuario. */
export const STORAGE_KEY = 'adp-theme';

/** Media query estándar para detectar preferencia de tema oscuro del OS. */
export const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Lee el theme del sistema operativo via `matchMedia`. SSR-safe: devuelve
 * el fallback si window no existe (server) o matchMedia no soporta
 * (browsers viejos / sandbox).
 *
 * Diseñada para ser inyectable: acepta un `matchMedia` opcional para
 * permitir tests sin necesitar el global del browser.
 */
export function readSystemTheme(
  matchMediaFn?: (q: string) => MediaQueryList | undefined,
): Theme {
  // Inyección explícita gana sobre el global.
  const fn =
    matchMediaFn ??
    (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia.bind(window)
      : undefined);
  if (!fn) return FALLBACK_THEME;
  try {
    const mq = fn(MEDIA_QUERY);
    if (!mq) return FALLBACK_THEME;
    return mq.matches ? 'dark' : 'light';
  } catch {
    return FALLBACK_THEME;
  }
}

/**
 * Lee la elección manual del usuario desde localStorage. Devuelve null si
 * nunca eligió o si el storage está inaccesible (sandbox / privacy mode).
 *
 * Diseñada para ser inyectable: acepta un `storage` opcional para tests.
 */
export function readStoredTheme(storage?: Storage | null): Theme | null {
  const s =
    storage !== undefined
      ? storage
      : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
  if (!s) return null;
  try {
    const stored = s.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resuelve qué theme aplicar dado lo que vino del storage y del sistema.
 * Encapsula la regla central: storage gana sobre sistema, y sistema sobre
 * el fallback. Esta función es la que vale la pena testear con casuística.
 */
export function resolveInitialTheme(
  stored: Theme | null,
  system: Theme,
): Theme {
  if (stored !== null) return stored;
  return system;
}
