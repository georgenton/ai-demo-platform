// Barrel del módulo i18n. Consumers escriben `from '@/lib/i18n'`.

export { LangProvider, useT } from './LangProvider';
export {
  makeT,
  STRINGS,
  SUGGESTED_DIMENSIONS_I18N,
  SUGGESTED_QUESTIONS_I18N,
} from './strings';
export { formatRelative } from './format';
export type { Lang, StringKey, T } from './strings';
