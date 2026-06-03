// -----------------------------------------------------------------------------
// Tests de la lógica de selección de theme (PR-MT7-prep).
//
// No renderizamos React acá (no tenemos jsdom en el proyecto). Testeamos
// directo las funciones puras del helper — cubre las reglas que importan:
//   - storage gana sobre sistema
//   - sistema gana sobre fallback
//   - inputs corruptos no rompen (null/throw/sin storage)
// -----------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

import {
  FALLBACK_THEME,
  MEDIA_QUERY,
  STORAGE_KEY,
  readStoredTheme,
  readSystemTheme,
  resolveInitialTheme,
} from './theme-helpers';

// ---------------------------------------------------------------------------
// resolveInitialTheme — la regla central del PR
// ---------------------------------------------------------------------------

describe('resolveInitialTheme', () => {
  it('respeta la elección del usuario en storage (dark) sobre el sistema (light)', () => {
    expect(resolveInitialTheme('dark', 'light')).toBe('dark');
  });

  it('respeta la elección del usuario en storage (light) sobre el sistema (dark)', () => {
    expect(resolveInitialTheme('light', 'dark')).toBe('light');
  });

  it('sigue al sistema cuando no hay elección manual', () => {
    expect(resolveInitialTheme(null, 'dark')).toBe('dark');
    expect(resolveInitialTheme(null, 'light')).toBe('light');
  });
});

// ---------------------------------------------------------------------------
// readSystemTheme — depende de matchMedia
// ---------------------------------------------------------------------------

/**
 * Helper que arma un fake matchMedia con un valor fijo de `matches`. Usa
 * el shape mínimo que el código del provider necesita.
 */
function makeMatchMedia(matches: boolean) {
  return vi.fn(
    () =>
      ({
        matches,
        media: MEDIA_QUERY,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

describe('readSystemTheme', () => {
  it('devuelve "dark" cuando matchMedia(prefers-color-scheme: dark).matches=true', () => {
    expect(readSystemTheme(makeMatchMedia(true))).toBe('dark');
  });

  it('devuelve "light" cuando matchMedia(prefers-color-scheme: dark).matches=false', () => {
    expect(readSystemTheme(makeMatchMedia(false))).toBe('light');
  });

  it('devuelve el FALLBACK cuando no hay matchMedia disponible (SSR/sandbox)', () => {
    expect(readSystemTheme(undefined)).toBe(FALLBACK_THEME);
  });

  it('devuelve el FALLBACK si matchMedia tira (browser raro)', () => {
    const throwing = vi.fn(() => {
      throw new Error('matchMedia no soportado');
    });
    expect(readSystemTheme(throwing)).toBe(FALLBACK_THEME);
  });
});

// ---------------------------------------------------------------------------
// readStoredTheme — depende de localStorage
// ---------------------------------------------------------------------------

/**
 * Helper que arma un Storage fake con un valor fijo. Devolvemos solo los
 * métodos que el código consume.
 */
function makeStorage(value: string | null): Storage {
  return {
    getItem: vi.fn((key: string) => (key === STORAGE_KEY ? value : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };
}

describe('readStoredTheme', () => {
  it('devuelve "light" cuando localStorage tiene "light"', () => {
    expect(readStoredTheme(makeStorage('light'))).toBe('light');
  });

  it('devuelve "dark" cuando localStorage tiene "dark"', () => {
    expect(readStoredTheme(makeStorage('dark'))).toBe('dark');
  });

  it('devuelve null cuando no hay valor en localStorage', () => {
    expect(readStoredTheme(makeStorage(null))).toBe(null);
  });

  it('devuelve null cuando el valor es basura (no "light" ni "dark")', () => {
    // Bug guard: si alguien hardcodeó "system" o "auto" en localStorage
    // por otra app, no queremos respetarlo. Solo nuestros valores válidos.
    expect(readStoredTheme(makeStorage('system'))).toBe(null);
    expect(readStoredTheme(makeStorage(''))).toBe(null);
  });

  it('devuelve null cuando el storage es null (SSR/sandbox)', () => {
    expect(readStoredTheme(null)).toBe(null);
  });

  it('devuelve null si getItem tira (private mode con quota agresiva)', () => {
    const throwing: Storage = {
      getItem: vi.fn(() => {
        throw new Error('private mode');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    expect(readStoredTheme(throwing)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Composición — los tres helpers juntos cubren la matriz completa
// ---------------------------------------------------------------------------

describe('matriz de decisión completa', () => {
  it('storage=dark, system=light → dark (usuario gana)', () => {
    const stored = readStoredTheme(makeStorage('dark'));
    const system = readSystemTheme(makeMatchMedia(false));
    expect(resolveInitialTheme(stored, system)).toBe('dark');
  });

  it('storage=light, system=dark → light (usuario gana)', () => {
    const stored = readStoredTheme(makeStorage('light'));
    const system = readSystemTheme(makeMatchMedia(true));
    expect(resolveInitialTheme(stored, system)).toBe('light');
  });

  it('storage vacío, system=dark → dark (sistema decide)', () => {
    const stored = readStoredTheme(makeStorage(null));
    const system = readSystemTheme(makeMatchMedia(true));
    expect(resolveInitialTheme(stored, system)).toBe('dark');
  });

  it('storage vacío, system=light → light (sistema decide)', () => {
    const stored = readStoredTheme(makeStorage(null));
    const system = readSystemTheme(makeMatchMedia(false));
    expect(resolveInitialTheme(stored, system)).toBe('light');
  });

  it('SSR puro (sin storage, sin matchMedia) → FALLBACK (light)', () => {
    const stored = readStoredTheme(null);
    const system = readSystemTheme(undefined);
    expect(resolveInitialTheme(stored, system)).toBe(FALLBACK_THEME);
  });
});
