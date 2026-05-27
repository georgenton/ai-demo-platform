// -----------------------------------------------------------------------------
// ThemeProvider — Context que expone { theme, setTheme, toggleTheme }.
//
// Modos: 'light' (default, salas iluminadas) y 'dark' (auditorio / proyector).
// La estrategia es la canónica de Next.js para evitar FOUC:
//   1) Script inline en <head> que lee localStorage y setea
//      `data-theme` ANTES del primer paint (ver inline-script.tsx).
//   2) Acá, el provider React sincroniza estado + listener para cambios.
//
// Persistencia: localStorage key 'adp-theme'. Si el storage está vacío o
// inaccesible, default = 'light'.
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

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const DEFAULT_THEME: Theme = 'light';
const STORAGE_KEY = 'adp-theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Misma estrategia SSR-safe que LangProvider: arranca con default y
  // rehydrata desde localStorage en useEffect. El flash visual lo evita el
  // script inline en <head>.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      }
    } catch {
      // ignoramos
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignoramos
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
    [],
  );

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
