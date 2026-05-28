// -----------------------------------------------------------------------------
// useTutorChat — hook que gestiona la conversación con el tutor.
//
// Mantiene:
//   - history: turnos completos (user/assistant).
//   - streamingText: lo que está aterrizando del backend en este turno.
//   - status: 'idle' | 'streaming' | 'error'.
//   - totalUsage: acumulado de tokens de toda la sesión (sumamos cada evento
//     usage que llega del backend). Esto alimenta el panel 3.
//   - lastError: string | null.
//
// El estado vive en el cliente: cada send() arma el body con el history
// completo + el último mensaje. Cuando termina el stream, mueve el
// streamingText al history como turno 'assistant'.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useRef, useState } from 'react';

import { subscribeToTutorChat } from '@/lib/api';
import type {
  TutorHistoryTurn,
  TutorLevel,
  TutorScenario,
  TutorSubscription,
  TutorUsage,
} from '@/lib/api';

export type TutorStatus = 'idle' | 'streaming' | 'error';

export interface UseTutorChatResult {
  history: TutorHistoryTurn[];
  streamingText: string;
  status: TutorStatus;
  /** Suma de tokens de TODA la sesión (todas las llamadas combinadas). */
  totalUsage: TutorUsage;
  /** Último error legible para mostrar al usuario. */
  lastError: string | null;
  send: (
    message: string,
    opts: { level: TutorLevel; scenario?: TutorScenario },
  ) => void;
  cancel: () => void;
  reset: () => void;
}

export function useTutorChat(): UseTutorChatResult {
  const [history, setHistory] = useState<TutorHistoryTurn[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState<TutorStatus>('idle');
  const [totalUsage, setTotalUsage] = useState<TutorUsage>({
    inputTokens: 0,
    outputTokens: 0,
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const subRef = useRef<TutorSubscription | null>(null);
  // Acumulador local del stream actual — evita carreras con setStreamingText.
  const bufferRef = useRef('');

  const send = useCallback(
    (
      message: string,
      opts: { level: TutorLevel; scenario?: TutorScenario },
    ) => {
      if (status === 'streaming') return;
      const trimmed = message.trim();
      if (!trimmed) return;

      const userTurn: TutorHistoryTurn = { role: 'user', content: trimmed };
      // Snapshot del history antes de mandar — vamos a usarlo para el body
      // exacto y para el setState final con assistant.
      const previousHistory = history;
      setHistory((h) => [...h, userTurn]);
      setStreamingText('');
      bufferRef.current = '';
      setStatus('streaming');
      setLastError(null);

      subRef.current = subscribeToTutorChat(
        {
          history: previousHistory,
          message: trimmed,
          level: opts.level,
          scenario: opts.scenario,
        },
        {
          onToken: (text) => {
            bufferRef.current += text;
            setStreamingText(bufferRef.current);
          },
          onUsage: (usage) => {
            setTotalUsage((acc) => ({
              inputTokens: acc.inputTokens + usage.inputTokens,
              outputTokens: acc.outputTokens + usage.outputTokens,
            }));
          },
          onDone: () => {
            const finalText = bufferRef.current;
            if (finalText) {
              setHistory((h) => [
                ...h,
                { role: 'assistant', content: finalText },
              ]);
            }
            setStreamingText('');
            bufferRef.current = '';
            setStatus('idle');
            subRef.current = null;
          },
          onError: (err) => {
            setLastError(err.message);
            setStatus('error');
            setStreamingText('');
            bufferRef.current = '';
            subRef.current = null;
          },
        },
      );
    },
    [history, status],
  );

  const cancel = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;
    setStreamingText('');
    bufferRef.current = '';
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;
    setHistory([]);
    setStreamingText('');
    bufferRef.current = '';
    setStatus('idle');
    setTotalUsage({ inputTokens: 0, outputTokens: 0 });
    setLastError(null);
  }, []);

  return {
    history,
    streamingText,
    status,
    totalUsage,
    lastError,
    send,
    cancel,
    reset,
  };
}
