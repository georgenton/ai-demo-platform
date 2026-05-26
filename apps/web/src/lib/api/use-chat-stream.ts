// -----------------------------------------------------------------------------
// useChatStream — hook React que envuelve subscribeToChat() y expone el
// stream del LLM como estado: texto acumulado, status y error.
//
// Por qué un hook y no llamar a subscribeToChat directo en el componente:
//   - Centraliza el ciclo de vida (suscribir / cerrar) y lo ata a useEffect
//     cleanup. Si el componente se desmonta o el usuario navega, cerramos
//     el EventSource automáticamente — sin esto, dejaríamos conexiones
//     colgadas y el browser eventualmente las acumula.
//   - Pasa el texto a través de useState, así React re-renderiza por cada
//     token y la UI ve la "escritura en vivo" que es parte del impacto
//     del Demo 01.
//   - Mantiene la lógica de transporte (EventSource) fuera de la UI: si
//     mañana cambiamos a fetch-streaming o WebSockets, el hook absorbe el
//     cambio sin tocar los componentes.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToChat } from './client';
import type { ChatQuery, ChatSubscription } from './types';

/** Estado del stream. Pensado como una pequeña máquina de estados explícita. */
export type ChatStreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseChatStreamResult {
  /** Texto acumulado del LLM hasta el momento. Se reinicia al llamar start(). */
  text: string;
  /** Estado actual del stream. Útil para deshabilitar el botón mientras corre. */
  status: ChatStreamStatus;
  /** Mensaje legible si status === 'error'. */
  error: string | null;
  /** Arranca un nuevo stream. Cierra el anterior si todavía estaba activo. */
  start: (query: ChatQuery) => void;
  /** Cancela el stream activo (si lo hay) y vuelve a 'idle' con texto vacío. */
  reset: () => void;
}

export function useChatStream(): UseChatStreamResult {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ChatStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Guardamos la suscripción activa en un ref (no state) — cambiarla no
  // debe disparar re-renders. Solo nos importa para poder cerrarla cuando
  // empezamos otro stream o cuando el componente se desmonta.
  const subscriptionRef = useRef<ChatSubscription | null>(null);

  const closeActive = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(
    (query: ChatQuery) => {
      // Si había un stream corriendo, lo cerramos antes de arrancar otro.
      // Sin esto dejaríamos dos EventSource activos y los tokens se
      // mezclarían en el mismo `text`.
      closeActive();

      setText('');
      setError(null);
      setStatus('streaming');

      subscriptionRef.current = subscribeToChat(query, {
        onToken: (token) => {
          // setText con función-updater para evitar leer un `text` stale
          // dentro del callback (closure sobre el primer render).
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

  // Cleanup al desmontar: cerramos cualquier conexión que haya quedado abierta.
  useEffect(() => {
    return () => {
      closeActive();
    };
  }, [closeActive]);

  return { text, status, error, start, reset };
}
