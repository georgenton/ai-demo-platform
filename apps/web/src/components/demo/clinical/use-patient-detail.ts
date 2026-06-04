// -----------------------------------------------------------------------------
// usePatientDetail — fetch del detalle de un paciente cuando el médico lo
// selecciona del panel izquierdo. Si `patientId` es null, no hace nada.
//
// AbortController igual que usePatientList: si el médico clickea otro
// paciente antes de que el primer detalle vuelva, cancelamos.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { ApiError, getClinicalPatientDetail } from '@/lib/api';
import type { ClinicalPatientDetail } from '@/lib/api';

export interface UsePatientDetailResult {
  patient: ClinicalPatientDetail | null;
  loading: boolean;
  error: string | null;
}

export function usePatientDetail(
  patientId: string | null,
): UsePatientDetailResult {
  const [patient, setPatient] = useState<ClinicalPatientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getClinicalPatientDetail(patientId, controller.signal)
      .then((p) => {
        setPatient(p);
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
  }, [patientId]);

  return { patient, loading, error };
}
