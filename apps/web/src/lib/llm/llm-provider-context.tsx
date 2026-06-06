// -----------------------------------------------------------------------------
// LlmProviderContext — Context React para el dropdown del header.
//
// El estado se persiste en localStorage (clave `adp-llm-provider`). Sin
// default: el primer render del context tiene `provider: null`. La UI del
// header muestra "Elige el modelo" hasta que el usuario abre el dropdown y
// selecciona. Mientras `provider === null`, los clientes HTTP no agregan
// el header `X-LLM-Provider` — el backend cae al singleton del env.
//
// Los helpers puros (sin React) viven en `llm-provider-storage.ts` para
// que el código de fetch/SSE pueda importar sin arrastrar React.
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

import { STORAGE_KEY, type LlmProviderId } from './llm-provider-storage';

interface LlmProviderContextValue {
  /** Provider elegido por el user, o `null` si todavía no eligió. */
  provider: LlmProviderId | null;
  setProvider: (next: LlmProviderId) => void;
  /** Limpia la elección (vuelve a null). Útil para tests, no hay UI hoy. */
  clear: () => void;
}

const LlmProviderContext = createContext<LlmProviderContextValue>({
  provider: null,
  setProvider: () => undefined,
  clear: () => undefined,
});

const VALID = new Set<LlmProviderId>(['anthropic', 'private-mac']);

export function LlmProviderProvider({ children }: { children: ReactNode }) {
  // SSR-safe: arranca con null en el primer render. Rehidrata desde
  // localStorage en useEffect (mismo patrón que ThemeProvider).
  const [provider, setProviderState] = useState<LlmProviderId | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.has(stored as LlmProviderId)) {
        setProviderState(stored as LlmProviderId);
      }
    } catch {
      // localStorage bloqueado (sandboxed iframe, privacy mode). Default null.
    }
  }, []);

  const setProvider = useCallback((next: LlmProviderId) => {
    setProviderState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignoramos
    }
  }, []);

  const clear = useCallback(() => {
    setProviderState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoramos
    }
  }, []);

  const value = useMemo<LlmProviderContextValue>(
    () => ({ provider, setProvider, clear }),
    [provider, setProvider, clear],
  );

  return (
    <LlmProviderContext.Provider value={value}>
      {children}
    </LlmProviderContext.Provider>
  );
}

export function useLlmProvider(): LlmProviderContextValue {
  return useContext(LlmProviderContext);
}
