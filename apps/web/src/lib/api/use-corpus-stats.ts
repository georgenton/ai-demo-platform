// -----------------------------------------------------------------------------
// useCorpusStats — hook fetch-based para GET /api/v1/corpus/stats.
//
// Pattern simple: useEffect + AbortController. Sin librería externa (SWR /
// React Query) — la app no la usa todavía en otros demos y no la justifica
// solo para este hook.
//
// El hook expone `refetch()` para que la UI pueda triggear un refresh
// manual después de un upload (las stats cambian).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchCorpusStats } from './corpus';
import type { CorpusStats } from './types-corpus';

export type CorpusStatsStatus = 'idle' | 'loading' | 'done' | 'error';

export interface UseCorpusStatsResult {
  data: CorpusStats | null;
  status: CorpusStatsStatus;
  error: string | null;
  /** Re-pide stats al backend. Útil tras un upload. */
  refetch: () => void;
}

export function useCorpusStats(): UseCorpusStatsResult {
  const [data, setData] = useState<CorpusStats | null>(null);
  const [status, setStatus] = useState<CorpusStatsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    fetchCorpusStats(controller.signal)
      .then((stats) => {
        setData(stats);
        setStatus('done');
      })
      .catch((err: unknown) => {
        // AbortError es esperado en cleanup — lo ignoramos para no marcar
        // como error la cancelación normal al desmontar / refetch.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
      });

    return () => controller.abort();
  }, [tick]);

  return { data, status, error, refetch };
}
