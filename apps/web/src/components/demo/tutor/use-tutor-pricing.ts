// -----------------------------------------------------------------------------
// useTutorPricing — fetcha el pricing una vez al montar la página.
//
// El pricing no cambia durante una sesión y es JSON chico (< 1 KB), así
// que no usamos cache global ni SWR — un useEffect simple alcanza.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { getTutorPricing } from '@/lib/api';
import type { TutorPricingResponse } from '@/lib/api';

export type PricingStatus = 'loading' | 'ready' | 'error';

export interface UseTutorPricingResult {
  pricing: TutorPricingResponse | null;
  status: PricingStatus;
  error: string | null;
}

export function useTutorPricing(): UseTutorPricingResult {
  const [pricing, setPricing] = useState<TutorPricingResponse | null>(null);
  const [status, setStatus] = useState<PricingStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTutorPricing()
      .then((data) => {
        if (cancelled) return;
        setPricing(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pricing, status, error };
}
