// -----------------------------------------------------------------------------
// usePatientList — hook que envuelve getClinicalPatients() con debounce.
//
// Por qué con debounce: el panel izquierdo del demo tiene un input de
// búsqueda libre; sin debounce dispararíamos un GET por keystroke. El
// kit usa 300ms (mismo contrato que documentamos en el handoff).
//
// El dataset son 30 pacientes — cualquier query es < 50ms. El debounce es por
// higiene de red, no por necesidad de performance.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { ApiError, getClinicalPatients } from '@/lib/api';
import type { ClinicalPatientSummary } from '@/lib/api';

const DEBOUNCE_MS = 300;

export interface UsePatientListResult {
  items: ClinicalPatientSummary[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function usePatientList(rawSearch: string): UsePatientListResult {
  const [items, setItems] = useState<ClinicalPatientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce del search box: actualizamos `debounced` solo después de que el
  // usuario para de tipear por DEBOUNCE_MS.
  const [debounced, setDebounced] = useState(rawSearch.trim());
  useEffect(() => {
    const id = setTimeout(() => setDebounced(rawSearch.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [rawSearch]);

  // Fetch on debounced-change. AbortController para cancelar peticiones
  // pisadas (importante si el user sigue tipeando antes de que el server
  // responda — sin abort el primer response llegaría tarde y pisaría el
  // resultado bueno).
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getClinicalPatients(
      debounced ? { search: debounced } : {},
      controller.signal,
    )
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [debounced]);

  return { items, total, loading, error };
}
