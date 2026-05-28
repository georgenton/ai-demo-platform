// -----------------------------------------------------------------------------
// useCorpusSearch — hook SSE para GET /api/v1/corpus/search.
//
// Mismo shape que useChatStream del Demo 01: text acumulado, status, error,
// start(query), reset(). Diferencia: no recibe `demoId` (el backend lo
// hardcodea a 'corpus' en este endpoint).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToCorpusSearch } from './corpus';
import type {
  CorpusSearchQuery,
  CorpusSearchSubscription,
} from './types-corpus';

export type CorpusSearchStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseCorpusSearchResult {
  text: string;
  status: CorpusSearchStatus;
  error: string | null;
  /** Arranca un nuevo search. Cancela el anterior si seguía corriendo. */
  start: (query: CorpusSearchQuery) => void;
  /** Cancela y vuelve a 'idle' con texto vacío. */
  reset: () => void;
}

export function useCorpusSearch(): UseCorpusSearchResult {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CorpusSearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<CorpusSearchSubscription | null>(null);

  const closeActive = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(
    (query: CorpusSearchQuery) => {
      closeActive();

      setText('');
      setError(null);
      setStatus('streaming');

      subscriptionRef.current = subscribeToCorpusSearch(query, {
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
    },
    [closeActive],
  );

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
