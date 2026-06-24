// -----------------------------------------------------------------------------
// useLoanChat — hook que orquesta el chat del Demo 09.
//
// Estado:
//   - leadId:      asignado tras el primer `done` del backend.
//   - messages:    array de turns (user, assistant, system).
//   - currentStage: la etapa actual del lead. Cambia al recibir
//                   `stage_changed`.
//   - isStreaming: true mientras un POST /chat está abierto.
//   - error:       último error del stream, null si no hay.
//
// Acciones:
//   - send(text): crea un mensaje user + abre el SSE. La respuesta del
//                 bot va llenando el último bubble assistant a medida
//                 que llegan tokens.
//   - retry():    re-envía el último mensaje user si hubo error.
//   - cleanup():  cierra el stream activo (en useEffect del unmount).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToLoanChat } from '@/lib/api';
import type {
  LoanChatSubscription,
  LoanChatToolEvent,
  LoanEligibilityResult,
  LoanStage,
} from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** Texto principal del bubble. Para system messages es el summary del tool. */
  text: string;
  /** Si es un evento de tool, el nombre — para que la UI elija un icono. */
  toolName?: LoanChatToolEvent['tool'];
  /** Si es un bubble assistant que mostró un EligibilityCard, el payload. */
  eligibility?: LoanEligibilityResult;
  /** Hora HH:MM (computada en el cliente). */
  time: string;
}

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface UseLoanChatState {
  leadId: string | null;
  messages: ChatMessage[];
  currentStage: LoanStage;
  isStreaming: boolean;
  error: string | null;
}

export interface UseLoanChat extends UseLoanChatState {
  send: (text: string) => void;
  retry: () => void;
}

export function useLoanChat(): UseLoanChat {
  const [state, setState] = useState<UseLoanChatState>({
    leadId: null,
    messages: [],
    currentStage: 'lead',
    isStreaming: false,
    error: null,
  });

  const subRef = useRef<LoanChatSubscription | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const leadIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      subRef.current?.close();
    };
  }, []);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    if (subRef.current) return;
    lastSentRef.current = text;

    const userMsg: ChatMessage = {
      id: nextMessageId(),
      role: 'user',
      text,
      time: nowTime(),
    };
    const assistantId = nextMessageId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      time: nowTime(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg, assistantPlaceholder],
      isStreaming: true,
      error: null,
    }));

    subRef.current = subscribeToLoanChat(
      {
        leadId: leadIdRef.current ?? undefined,
        message: text,
      },
      {
        onEvent: (event) => {
          if (event.type === 'token') {
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + event.text } : m,
              ),
            }));
          } else if (event.type === 'tool') {
            // Para eligibility la mostramos como bubble assistant con card,
            // no como system. Para las otras tools, system message.
            if (event.tool === 'calculate_loan_eligibility') {
              const eligibility = event.payload as LoanEligibilityResult;
              setState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: nextMessageId(),
                    role: 'assistant',
                    text: '',
                    eligibility,
                    time: nowTime(),
                  },
                ],
              }));
            } else {
              setState((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: nextMessageId(),
                    role: 'system',
                    text: event.summary,
                    toolName: event.tool,
                    time: nowTime(),
                  },
                ],
              }));
            }
          } else if (event.type === 'stage_changed') {
            setState((prev) => ({
              ...prev,
              currentStage: event.toStage,
            }));
          } else if (event.type === 'done') {
            leadIdRef.current = event.leadId;
            setState((prev) => ({
              ...prev,
              leadId: event.leadId,
            }));
          } else if (event.type === 'error_event') {
            setState((prev) => ({
              ...prev,
              error: event.message,
            }));
          }
        },
        onDone: () => {
          subRef.current = null;
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            // Quita el placeholder assistant si nunca recibió texto.
            messages: prev.messages.filter(
              (m, i, arr) =>
                !(
                  m.role === 'assistant' &&
                  m.text === '' &&
                  !m.eligibility &&
                  i === arr.length - 1
                ),
            ),
          }));
        },
        onError: (err) => {
          subRef.current = null;
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err.message,
          }));
        },
      },
    );
  }, []);

  const retry = useCallback(() => {
    const last = lastSentRef.current;
    if (!last) return;
    // Limpia el último mensaje user + assistant que quedaron a medias
    // (los re-vamos a crear desde send()).
    setState((prev) => {
      const trimmed = [...prev.messages];
      while (
        trimmed.length > 0 &&
        ['user', 'assistant'].includes(trimmed[trimmed.length - 1].role)
      ) {
        const popped = trimmed.pop();
        if (popped?.role === 'user') break;
      }
      return { ...prev, messages: trimmed, error: null };
    });
    send(last);
  }, [send]);

  return {
    ...state,
    send,
    retry,
  };
}
