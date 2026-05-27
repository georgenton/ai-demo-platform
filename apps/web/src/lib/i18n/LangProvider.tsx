// -----------------------------------------------------------------------------
// LangProvider — Context que expone { lang, t, setLang, toggleLang } al árbol.
//
// Persistencia:
//   - localStorage key 'adp-lang' (mismo nombre que usa el kit del handoff).
//   - Para evitar flash de FOUC ES↔EN al cargar, hay un script inline en el
//     <head> (ver app/layout.tsx) que setea `document.documentElement.lang`
//     ANTES de pintar. Acá nada más sincronizamos el estado React con eso.
//
// SSR-safe: arrancamos con un default ('es') y rehydratamos desde
// localStorage en useEffect. Eso causa un render extra del lado cliente —
// aceptable para una app interna; si en algún momento aparece flash visible
// del switch ES/EN, movemos la lectura inicial al script inline.
// -----------------------------------------------------------------------------

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { makeT, type Lang, type StringKey } from './strings';

interface LangContextValue {
  lang: Lang;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
}

const DEFAULT_LANG: Lang = 'es';
const STORAGE_KEY = 'adp-lang';

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  t: makeT(DEFAULT_LANG),
  setLang: () => undefined,
  toggleLang: () => undefined,
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Arrancamos con DEFAULT_LANG en el primer render (SSR + cliente),
  // después rehydratamos al valor real del localStorage. Este flicker es
  // invisible al usuario porque el script inline del layout ya setea el
  // atributo `lang` en el <html> con el valor correcto.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'es' || stored === 'en') {
        setLangState(stored);
      }
    } catch {
      // localStorage puede no existir (sandboxed iframes, etc.). Ignoramos.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignoramos: no-op
    }
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(
    () => setLangState((current) => (current === 'es' ? 'en' : 'es')),
    [],
  );

  const value = useMemo<LangContextValue>(
    () => ({ lang, t: makeT(lang), setLang, toggleLang }),
    [lang, setLang, toggleLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/**
 * Hook para componentes — devuelve `{ lang, t, setLang, toggleLang }`.
 *
 * Uso típico:
 *   const { t, lang } = useT();
 *   <h1>{t('rag.title')}</h1>
 */
export function useT(): LangContextValue {
  return useContext(LangContext);
}
