// -----------------------------------------------------------------------------
// useCorpusSummary — hook SSE para GET /api/v1/corpus/summary.
//
// Similar a useCorpusSearch pero sin parámetros: el endpoint procesa todo
// el corpus. Tarda ~30-60s la primera vez (map-reduce con N llamadas LLM en
// el server) — durante el wait inicial, `text` está vacío y `status` queda
// en 'streaming'. La UI puede mostrar un loading skeleton hasta que llegue
// el primer token del reduce.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToCorpusSummary } from './corpus';
import type { CorpusSummarySubscription } from './types-corpus';

export type CorpusSummaryStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseCorpusSummaryResult {
  text: string;
  status: CorpusSummaryStatus;
  error: string | null;
  /** Dispara la generación del summary. Cancela el anterior si seguía. */
  start: () => void;
  /** Cancela y vuelve a 'idle' con texto vacío. */
  reset: () => void;
}

export function useCorpusSummary(): UseCorpusSummaryResult {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CorpusSummaryStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<CorpusSummarySubscription | null>(null);

  const closeActive = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(() => {
    closeActive();

    setText('');
    setError(null);
    setStatus('streaming');

    subscriptionRef.current = subscribeToCorpusSummary({
      onToken: (token) => {
        setText((prev) => prev + token);
      },
      onDone: () => {
        setStatus('done');
        subscriptionRef.current = null;
      },
      onError: (err) => {
        setError(err.message);
        setStatus('error');
        subscriptionRef.current = null;
      },
    });
  }, [closeActive]);

  const reset = useCallback(() => {
    closeActive();
    setText('');
    setError(null);
    setStatus('idle');
  }, [closeActive]);

  useEffect(() => {
    return () => {
      closeActive();
    };
  }, [closeActive]);

  return { text, status, error, start, reset };
}
