// -----------------------------------------------------------------------------
// subscribeToEventSource — helper para SSE GET con detección robusta de
// "fin feliz".
//
// Replica la lógica fixada en PR #41 (`subscribeToChat`): EventSource del
// browser SIEMPRE dispara `onerror` cuando el server cierra el stream — con
// `readyState` igual a `CONNECTING` (no `CLOSED`, porque por default
// EventSource intenta reconectar). La heurística: si ya recibimos al menos
// un token y después `onerror` dispara, asumimos cierre limpio post-respuesta.
// Si dispara sin haber recibido nada, es error real (404, 401, network down).
//
// Por qué un helper separado en lugar de refactorizar subscribeToChat:
//   `subscribeToChat` está en producción funcionando. Romperla en un PR del
//   Demo 03 sería riesgoso. Para corpus reusamos el patrón vía este helper;
//   si en otro PR limpio queremos consolidar, lo hacemos sin presión.
// -----------------------------------------------------------------------------

export interface EventSourceHandlers {
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface EventSourceSubscription {
  close: () => void;
}

/**
 * Abre un EventSource a la URL dada y delega los eventos al caller.
 *
 * @param url URL absoluta o relativa al backend (debe ser SSE GET).
 * @param handlers callbacks de token / done / error.
 * @returns un handle con `close()` para cancelar desde el caller (típicamente
 *   en el cleanup de un useEffect).
 */
export function subscribeToEventSource(
  url: string,
  handlers: EventSourceHandlers,
): EventSourceSubscription {
  const source = new EventSource(url);

  let closed = false;
  let receivedAny = false;

  const closeOnce = (): void => {
    if (closed) return;
    closed = true;
    source.close();
  };

  source.onmessage = (event: MessageEvent<string>) => {
    receivedAny = true;
    handlers.onToken(event.data);
  };

  source.onerror = () => {
    closeOnce();
    if (receivedAny) {
      // Cerramos después de tokens → cierre limpio post-respuesta.
      handlers.onDone?.();
      return;
    }
    // Sin tokens y onerror → error real (404, 401, network down).
    handlers.onError?.(new Error('Event stream connection error'));
  };

  return {
    close: closeOnce,
  };
}
