// -----------------------------------------------------------------------------
// useHrJobs — hook simple para el GET /api/v1/hr/jobs.
//
// El catálogo de 6 roles cambia sólo cuando el seed cambia, así que en el demo
// no necesitamos cache, refetch ni invalidación. Fetch on mount + AbortController
// para cancelar si el usuario sale antes que la respuesta vuelva.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { ApiError, getHrJobs } from '@/lib/api';
import type { HrJobSummary } from '@/lib/api';

export interface UseHrJobsResult {
  items: HrJobSummary[];
  loading: boolean;
  error: string | null;
}

export function useHrJobs(): UseHrJobsResult {
  const [items, setItems] = useState<HrJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getHrJobs(controller.signal)
      .then((res) => {
        setItems(res.items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) setError(err.message);
        else if (err instanceof Error) setError(err.message);
        else setError(String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { items, loading, error };
}
