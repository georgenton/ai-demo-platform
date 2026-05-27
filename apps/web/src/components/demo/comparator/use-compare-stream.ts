// -----------------------------------------------------------------------------
// useCompareStream — hook análogo a useChatStream pero para el endpoint
// POST /api/v1/compare (también SSE, también de solo tokens — sin eventos
// tipados como el agente).
//
// API: { text, status, error, start, reset }
//   status: 'idle' | 'streaming' | 'done' | 'error'
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  subscribeToCompare,
  type CompareRequest,
  type CompareSubscription,
} from '@/lib/api';

export type CompareStreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseCompareStreamResult {
  text: string;
  status: CompareStreamStatus;
  error: string | null;
  start: (request: CompareRequest) => void;
  reset: () => void;
}

export function useCompareStream(): UseCompareStreamResult {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CompareStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<CompareSubscription | null>(null);

  const closeActive = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;
  }, []);

  const start = useCallback(
    (request: CompareRequest) => {
      // Cancelamos cualquier run en curso antes de arrancar otro.
      closeActive();

      setText('');
      setError(null);
      setStatus('streaming');

      subRef.current = subscribeToCompare(request, {
        onToken: (token) => setText((prev) => prev + token),
        onDone: () => {
          setStatus('done');
          subRef.current = null;
        },
        onError: (err) => {
          setError(err.message);
          setStatus('error');
          subRef.current = null;
        },
      });
    },
    [closeActive],
  );

  const reset = useCallback(() => {
    closeActive();
    setText('');
    setError(null);
    setStatus('idle');
  }, [closeActive]);

  useEffect(() => closeActive, [closeActive]);

  return { text, status, error, start, reset };
}
