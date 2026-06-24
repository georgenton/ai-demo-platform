// -----------------------------------------------------------------------------
// useMyDemos() — hook que provee la cartelera del tenant del usuario logueado.
//
// Analogía:
//   Si useAuth() es el portero (sabe quién entró), useMyDemos() es la
//   recepcionista que tiene la lista impresa de qué salas tiene autorizadas
//   ese visitante. Cualquier componente que necesite renderizar tarjetas
//   de demos (dashboard, sidebar) consume este hook.
//
// El hook se activa solo cuando hay sesión authenticated. Antes, devuelve
// `status: 'idle'` (no estamos esperando datos porque no hay sesión).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { getMyDemos } from '@/lib/api/auth';
import type { MeDemosResponse } from '@/lib/api/types-auth';
import { setTenantLlmProvider } from '@/lib/llm';

import { useAuth } from './auth-context';

export type MyDemosStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseMyDemosValue {
  status: MyDemosStatus;
  data: MeDemosResponse | null;
  errorMessage: string | null;
  /** Re-fetch manual — útil tras un cambio en /admin/tenant. */
  refresh: () => Promise<void>;
}

export function useMyDemos(): UseMyDemosValue {
  const auth = useAuth();
  const [status, setStatus] = useState<MyDemosStatus>('idle');
  const [data, setData] = useState<MeDemosResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    try {
      const result = await getMyDemos(signal);
      if (signal?.aborted) return;
      setData(result);
      // ADR-0022: cacheamos el provider del tenant en localStorage para que
      // los fetchers (no-React) lo lean al armar el header X-LLM-Provider.
      // El override manual del user en el dropdown del header sigue ganando.
      setTenantLlmProvider(result.tenant.llmProvider);
      setStatus('ready');
      setErrorMessage(null);
    } catch (err) {
      if (signal?.aborted) return;
      // 401 lo dejamos pasar — el AuthProvider/middleware ya redirige a /login.
      if (err instanceof ApiError && err.status === 401) {
        setData(null);
        setStatus('idle');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setErrorMessage(msg);
    }
  }, []);

  // Auto-cargar cuando hay sesión authenticated. Si la sesión se va
  // (logout), limpiamos y volvemos a idle.
  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setData(null);
      setStatus('idle');
      setErrorMessage(null);
      // En logout también limpiamos el provider cacheado — el próximo
      // user que entre en este browser empieza con su propio tenant.
      setTenantLlmProvider(null);
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [auth.status, load]);

  const refresh = useCallback(() => load(), [load]);

  return { status, data, errorMessage, refresh };
}
