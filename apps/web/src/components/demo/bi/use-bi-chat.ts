// -----------------------------------------------------------------------------
// useBiChat — hook que orquesta el flujo del Demo 10.
//
// Estado:
//   - turns:           array de turns. Cada turn es una pregunta + respuesta
//                      (sql + rows + chart + narrativa).
//   - currentTurn:     turn parcial mientras llega el SSE (null cuando idle).
//   - status:          'idle' | 'streaming'.
//   - error:           último error de stream, null si no hay.
//   - conversationId:  asignado tras el primer `done`. Permite refinement.
//
// Acciones:
//   - ask(text):   manda pregunta + abre SSE.
//   - retry():     re-pregunta la última.
//   - reset():     vacía el historial y empieza conversación nueva.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToBiChat } from '@/lib/api';
import type { BiChartSpec, BiChatSubscription } from '@/lib/api';

export interface BiTurn {
  id: string;
  question: string;
  narrative: string;
  sql: string | null;
  tablesUsed: string[];
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  chart: BiChartSpec | null;
  /** True mientras el SSE de este turn sigue abierto. */
  streaming: boolean;
  error: string | null;
}

let turnIdCounter = 0;
function nextTurnId(): string {
  turnIdCounter += 1;
  return `turn-${turnIdCounter}`;
}

export interface UseBiChatState {
  turns: BiTurn[];
  status: 'idle' | 'streaming';
  error: string | null;
  conversationId: string | null;
}

export interface UseBiChat extends UseBiChatState {
  ask: (text: string) => void;
  retry: () => void;
  reset: () => void;
}

export function useBiChat(): UseBiChat {
  const [state, setState] = useState<UseBiChatState>({
    turns: [],
    status: 'idle',
    error: null,
    conversationId: null,
  });

  const subRef = useRef<BiChatSubscription | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      subRef.current?.close();
    };
  }, []);

  const ask = useCallback((text: string) => {
    const question = text.trim();
    if (!question) return;
    if (subRef.current) return;
    lastQuestionRef.current = question;

    const turnId = nextTurnId();
    const fresh: BiTurn = {
      id: turnId,
      question,
      narrative: '',
      sql: null,
      tablesUsed: [],
      columns: [],
      rows: [],
      rowCount: 0,
      chart: null,
      streaming: true,
      error: null,
    };

    setState((prev) => ({
      ...prev,
      turns: [...prev.turns, fresh],
      status: 'streaming',
      error: null,
    }));

    subRef.current = subscribeToBiChat(
      {
        conversationId: conversationIdRef.current ?? undefined,
        message: question,
      },
      {
        onEvent: (event) => {
          if (event.type === 'token') {
            setState((prev) => ({
              ...prev,
              turns: prev.turns.map((t) =>
                t.id === turnId
                  ? { ...t, narrative: t.narrative + event.text }
                  : t,
              ),
            }));
          } else if (event.type === 'sql') {
            setState((prev) => ({
              ...prev,
              turns: prev.turns.map((t) =>
                t.id === turnId
                  ? { ...t, sql: event.sql, tablesUsed: event.tablesUsed }
                  : t,
              ),
            }));
          } else if (event.type === 'rows') {
            setState((prev) => ({
              ...prev,
              turns: prev.turns.map((t) =>
                t.id === turnId
                  ? {
                      ...t,
                      columns: event.columns,
                      rows: event.rows,
                      rowCount: event.rowCount,
                    }
                  : t,
              ),
            }));
          } else if (event.type === 'chart') {
            setState((prev) => ({
              ...prev,
              turns: prev.turns.map((t) =>
                t.id === turnId ? { ...t, chart: event.spec } : t,
              ),
            }));
          } else if (event.type === 'done') {
            conversationIdRef.current = event.conversationId;
            setState((prev) => ({
              ...prev,
              conversationId: event.conversationId,
            }));
          } else if (event.type === 'error_event') {
            setState((prev) => ({
              ...prev,
              error: event.message,
              turns: prev.turns.map((t) =>
                t.id === turnId ? { ...t, error: event.message } : t,
              ),
            }));
          }
        },
        onDone: () => {
          subRef.current = null;
          setState((prev) => ({
            ...prev,
            status: 'idle',
            turns: prev.turns.map((t) =>
              t.id === turnId ? { ...t, streaming: false } : t,
            ),
          }));
        },
        onError: (err) => {
          subRef.current = null;
          setState((prev) => ({
            ...prev,
            status: 'idle',
            error: err.message,
            turns: prev.turns.map((t) =>
              t.id === turnId
                ? { ...t, streaming: false, error: err.message }
                : t,
            ),
          }));
        },
      },
    );
  }, []);

  const retry = useCallback(() => {
    const q = lastQuestionRef.current;
    if (!q) return;
    setState((prev) => ({
      ...prev,
      error: null,
      // Quita el último turn (era el que falló).
      turns: prev.turns.slice(0, -1),
    }));
    ask(q);
  }, [ask]);

  const reset = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;
    conversationIdRef.current = null;
    lastQuestionRef.current = null;
    setState({
      turns: [],
      status: 'idle',
      error: null,
      conversationId: null,
    });
  }, []);

  return {
    ...state,
    ask,
    retry,
    reset,
  };
}
