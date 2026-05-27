// useAgentHistory — hook para la tab "Historial de consultas".
// Wrapper de getAgentHistory con loading/ready/error + refresh manual.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, getAgentHistory, type AgentHistoryEntry } from '@/lib/api';

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseAgentHistoryResult {
  entries: AgentHistoryEntry[];
  status: HistoryStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_LIMIT = 20;

export function useAgentHistory(): UseAgentHistoryResult {
  const [entries, setEntries] = useState<AgentHistoryEntry[]>([]);
  const [status, setStatus] = useState<HistoryStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);
    try {
      const result = await getAgentHistory(
        { limit: DEFAULT_LIMIT },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setEntries(result.items);
      setStatus('ready');
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido al cargar el historial';
      setError(message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  return { entries, status, error, refresh };
}
