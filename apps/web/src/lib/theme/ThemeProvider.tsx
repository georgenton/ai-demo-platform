// -----------------------------------------------------------------------------
// ThemeProvider — Context que expone { theme, setTheme, toggleTheme }.
//
// Modos: 'light' y 'dark'. Política de selección (PR-MT7-prep):
//   1) Si el usuario eligió manualmente (hay valor en localStorage) → ese.
//   2) Si no eligió nunca → seguir al sistema operativo
//      (`prefers-color-scheme`), y reaccionar si lo cambia mientras la
//      app está abierta.
//
// La estrategia anti-FOUC es la canónica de Next.js:
//   1) Script inline en <head> que lee localStorage y prefers-color-scheme,
//      y setea `data-theme` ANTES del primer paint (ver inline-script.tsx).
//   2) Acá, el provider React sincroniza estado + listener para cambios.
//
// Persistencia: localStorage key 'adp-theme'. Cuando el usuario aprieta
// el toggle del header, persistimos su elección y dejamos de seguir al OS.
// (Patrón estándar — ej. Linear, Vercel.)
//
// Lógica de decisión y helpers viven en theme-helpers.ts para ser
// testeables sin renderizar React.
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

import {
  FALLBACK_THEME,
  MEDIA_QUERY,
  STORAGE_KEY,
  readStoredTheme,
  readSystemTheme,
  resolveInitialTheme,
  type Theme,
} from './theme-helpers';

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: FALLBACK_THEME,
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Misma estrategia SSR-safe que LangProvider: arranca con fallback en el
  // primer render (cliente y server idénticos) y rehydrata en useEffect.
  // El flash visual lo evita el script inline en <head>.
  const [theme, setThemeState] = useState<Theme>(FALLBACK_THEME);
  // Track de si el usuario eligió manualmente (= "hay valor en
  // localStorage"). Mientras esto sea false, seguimos al OS.
  const [userPicked, setUserPicked] = useState<boolean>(false);

  // Rehidratación inicial: ¿el usuario eligió, o seguimos al sistema?
  useEffect(() => {
    const stored = readStoredTheme();
    const system = readSystemTheme();
    setThemeState(resolveInitialTheme(stored, system));
    setUserPicked(stored !== null);
  }, []);

  // Listener al cambio del sistema operativo. Solo aplica si el usuario
  // todavía NO eligió manualmente — si ya eligió, su elección manda y el
  // OS no la pisa.
  useEffect(() => {
    if (userPicked) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(MEDIA_QUERY);
    } catch {
      return;
    }

    const handler = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };

    // addEventListener es el API moderno; algunos browsers antiguos solo
    // soportan addListener. Usamos el moderno y aceptamos no soportar
    // navegadores pre-2020 (que no son objetivo del producto).
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [userPicked]);

  // Sincronización de data-theme en el <html>. El script anti-FOUC ya lo
  // setea pre-paint; este efecto cubre cambios en sesión (toggle del header
  // o cambio del OS mientras la app está abierta).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // setTheme: el usuario eligió manualmente → persistimos y dejamos de
  // seguir al OS.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setUserPicked(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignoramos
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignoramos
      }
      return next;
    });
    setUserPicked(true);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
