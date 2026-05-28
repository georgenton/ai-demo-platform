// -----------------------------------------------------------------------------
// useCorpusPapers — hook fetch-based paginado para GET /api/v1/corpus/papers.
//
// API:
//   - `data`: respuesta entera con items + total + limit + offset.
//   - `status`: máquina de estados del fetch.
//   - `error`: mensaje legible si falla.
//   - `setPage({limit, offset})`: cambia los params del fetch en uso. Útil
//     para paginación o cambio de pageSize desde la UI.
//   - `refetch()`: vuelve a pedir con los params actuales.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchCorpusPapers } from './corpus';
import type { CorpusPapersQuery, CorpusPapersResponse } from './types-corpus';

export type CorpusPapersStatus = 'idle' | 'loading' | 'done' | 'error';

export interface UseCorpusPapersResult {
  data: CorpusPapersResponse | null;
  status: CorpusPapersStatus;
  error: string | null;
  /** Cambia los params (limit/offset) y dispara fetch automático. */
  setQuery: (query: CorpusPapersQuery) => void;
  /** Re-pide con los params actuales. Útil tras un upload. */
  refetch: () => void;
}

/**
 * @param initial Default `{ limit: 20, offset: 0 }`. Se aplica solo en el
 *   primer render — cambios posteriores requieren `setQuery`.
 */
export function useCorpusPapers(
  initial: CorpusPapersQuery = {},
): UseCorpusPapersResult {
  const [query, setQuery] = useState<CorpusPapersQuery>(initial);
  const [data, setData] = useState<CorpusPapersResponse | null>(null);
  const [status, setStatus] = useState<CorpusPapersStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    fetchCorpusPapers(query, controller.signal)
      .then((res) => {
        setData(res);
        setStatus('done');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
      });

    return () => controller.abort();
    // `query` se compara por referencia — `setQuery` reemplaza el objeto
    // entero, así que esto se re-dispara correctamente.
  }, [query, tick]);

  return { data, status, error, setQuery, refetch };
}
