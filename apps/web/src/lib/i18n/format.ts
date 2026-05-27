// -----------------------------------------------------------------------------
// Formato de fechas relativas, lang-aware.
//
// Port del helper `formatRelative` de docs/design/ui_kit_web/i18n.jsx.
// Útil para los doc-cards y la pestaña de historial del agente, donde
// queremos "hace 5 min" en vez de un timestamp absoluto.
// -----------------------------------------------------------------------------

import { makeT, type Lang } from './strings';

/**
 * Convierte una fecha ISO/Date a un string relativo:
 *   - < 1 min → "hace unos segundos" / "a few seconds ago"
 *   - < 1 h   → "hace N min" / "N min ago"
 *   - < 1 día → "hace N h" / "Nh ago"
 *   - ≥ 1 día → "hace N días" / "N days ago"
 *
 * Más allá de unos días, lo más útil sería un absoluto ("23 oct, 14:32") —
 * eso lo agregamos cuando aparezca el caso.
 */
export function formatRelative(
  date: Date | string | number,
  lang: Lang,
): string {
  const t = makeT(lang);
  const ts = typeof date === 'number' ? date : new Date(date).getTime();
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return t('time.seconds');
  if (diff < 3600) return t('time.minutes', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hours', { n: Math.floor(diff / 3600) });
  return t('time.days', { n: Math.floor(diff / 86400) });
}
