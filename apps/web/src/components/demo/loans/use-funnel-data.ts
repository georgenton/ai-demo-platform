// -----------------------------------------------------------------------------
// useFunnelData — carga la lista de leads + métricas para la vista oficial.
//
// Estrategia simple para el demo: refetch cada `pollIntervalMs` (default
// 15s). En una versión futura se reemplazaría con un SSE push del backend
// (sub-PR 5+).
//
// Estado:
//   - leads:    array de LoanLeadListItem (hasta 200).
//   - metrics:  LoanFunnelMetrics con totales por etapa.
//   - loading:  true mientras la PRIMERA carga está en curso.
//   - refreshing: true durante refetches subsecuentes (sin parpadear UI).
//   - error:    último error de red.
//   - lastUpdatedAt: timestamp del último refetch exitoso.
//
// Acciones:
//   - refresh(): forzar refetch ahora.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getLoanMetrics, listLoans } from '@/lib/api';
import type { LoanFunnelMetrics, LoanLeadListItem } from '@/lib/api';

export interface UseFunnelDataState {
  leads: LoanLeadListItem[];
  metrics: LoanFunnelMetrics | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
}

export interface UseFunnelData extends UseFunnelDataState {
  refresh: () => Promise<void>;
}

const DEFAULT_POLL_MS = 15_000;

export function useFunnelData(pollIntervalMs = DEFAULT_POLL_MS): UseFunnelData {
  const [state, setState] = useState<UseFunnelDataState>({
    leads: [],
    metrics: null,
    loading: true,
    refreshing: false,
    error: null,
    lastUpdatedAt: null,
  });

  // Evita race conditions si el refetch en curso termina DESPUÉS de un
  // refetch posterior. Cada call al refresh() incrementa el counter; al
  // resolver solo aplicamos el resultado si es el counter más reciente.
  const refetchCounter = useRef(0);

  const refresh = useCallback(async () => {
    const myId = ++refetchCounter.current;
    setState((prev) => ({
      ...prev,
      refreshing: !prev.loading, // ya en loading inicial → no cambies a refreshing
    }));
    try {
      const [leads, metrics] = await Promise.all([
        listLoans(),
        getLoanMetrics(),
      ]);
      if (myId !== refetchCounter.current) return;
      setState({
        leads,
        metrics,
        loading: false,
        refreshing: false,
        error: null,
        lastUpdatedAt: new Date(),
      });
    } catch (err) {
      if (myId !== refetchCounter.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    if (pollIntervalMs <= 0) return;
    const interval = setInterval(() => {
      refresh();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs, refresh]);

  return {
    ...state,
    refresh,
  };
}
