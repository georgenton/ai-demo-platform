// -----------------------------------------------------------------------------
// useAgent — hook que envuelve subscribeToAgent y mantiene el estado visual.
//
// API:
//   const { events, status, start, reset } = useAgent();
//   start({ q: '¿Cuántos estudiantes hay?', demoId: 'agent' });
//
//   - events: AgentRunEvent[] (lo que la consola pinta)
//   - status: 'idle' | 'running' | 'done' | 'error'
//   - start(req): arranca un run nuevo (cancela el anterior si lo hay)
//   - reset(): limpia events y vuelve a idle
//
// Cleanup: si el componente se desmonta o se llama start() de nuevo,
// cerramos la subscription previa (igual que useChatStream).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  subscribeToAgent,
  type AgentRequest,
  type AgentSubscription,
} from '@/lib/api';

import { reduceAgentEvent } from './agent-events-reducer';
import type { AgentRunEvent, AgentRunStatus } from './types';

export interface UseAgentResult {
  events: AgentRunEvent[];
  status: AgentRunStatus;
  /** Arranca un run nuevo (resetea events, cancela el anterior). */
  start: (request: AgentRequest) => void;
  /** Cancela el run en curso y vuelve a idle con events vacíos. */
  reset: () => void;
}

export function useAgent(): UseAgentResult {
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>('idle');

  const subscriptionRef = useRef<AgentSubscription | null>(null);

  const closeActive = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(
    (request: AgentRequest) => {
      // Cancelamos cualquier run previo en curso. Sin esto, los eventos
      // del run viejo seguirían llegando y se mezclarían con los nuevos.
      closeActive();

      // Estado inicial: pregunta + thinking placeholder. El placeholder lo
      // remueve el reducer apenas llegue el primer evento real del backend.
      setEvents([{ kind: 'question', text: request.q }, { kind: 'thinking' }]);
      setStatus('running');

      subscriptionRef.current = subscribeToAgent(request, {
        onEvent: (event) => {
          setEvents((prev) => reduceAgentEvent(prev, event));
          // El status `running` ya se setteó al arrancar; solo lo cambiamos
          // cuando llegue un evento terminal del backend.
          if (event.type === 'done') {
            setStatus('done');
          } else if (event.type === 'error') {
            setStatus('error');
          }
        },
        onDone: () => {
          // Cierre limpio del SSE (server cierra la conexión). Si ya
          // pasamos por status='done' via el event, esto es no-op.
          subscriptionRef.current = null;
          setStatus((prev) => (prev === 'running' ? 'done' : prev));
        },
        onError: (err) => {
          // Falla de conexión / fetch. Materializamos un error en events
          // (el reducer lo trata igual que un `error` event del backend).
          setEvents((prev) =>
            reduceAgentEvent(prev, { type: 'error', message: err.message }),
          );
          setStatus('error');
          subscriptionRef.current = null;
        },
      });
    },
    [closeActive],
  );

  const reset = useCallback(() => {
    closeActive();
    setEvents([]);
    setStatus('idle');
  }, [closeActive]);

  // Cleanup al desmontar.
  useEffect(() => closeActive, [closeActive]);

  return { events, status, start, reset };
}
