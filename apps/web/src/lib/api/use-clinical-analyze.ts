// -----------------------------------------------------------------------------
// useClinicalAnalyze — hook React que envuelve subscribeToClinicalAnalyze y
// expone el stream del LLM + las tool calls como estado React.
//
// A diferencia de useChatStream (Demo 01) que solo acumula texto, este hook
// también acumula:
//   - Las llamadas a la herramienta (`toolCalls`) — para que el panel
//     muestre "Consultando interacciones de X, Y, Z…".
//   - Los resultados de la herramienta (`toolResults`) — para mostrar
//     cards con las interacciones encontradas.
//
// El consumer puede renderizar todo en la misma burbuja en orden cronológico
// o segmentar (texto en una columna, tools en otra). Eso es decisión visual.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToClinicalAnalyze } from './clinical';
import type {
  ClinicalAnalyzeRequest,
  ClinicalAnalyzeSubscription,
  ClinicalInteraction,
} from './types-clinical';

/** Pequeña máquina de estados del análisis. */
export type ClinicalAnalyzeStatus = 'idle' | 'streaming' | 'done' | 'error';

/**
 * Una entrada de la timeline visual: el panel del análisis renderiza este
 * array en orden, mezclando burbujas de texto, cards de "llamando tool" y
 * cards de "resultado del tool".
 *
 * Por qué un array unificado en vez de tres separados (texts, toolCalls,
 * toolResults): el orden cronológico importa para que la UI cuente la
 * historia "el LLM dijo X, luego consultó Y, luego dijo Z basado en eso".
 * Con tres arrays separados perdés ese hilo narrativo.
 */
export type ClinicalAnalyzeEntry =
  | { kind: 'text'; text: string }
  | { kind: 'tool_call'; medications: string[] }
  | { kind: 'tool_result'; interactions: ClinicalInteraction[] };

export interface UseClinicalAnalyzeResult {
  /** Timeline en orden cronológico. Lista para mapear con .map(). */
  entries: ClinicalAnalyzeEntry[];
  /** Estado actual del stream. */
  status: ClinicalAnalyzeStatus;
  /** Mensaje legible si status === 'error'. */
  error: string | null;
  /** Arranca un análisis nuevo. Cierra el anterior si seguía activo. */
  start: (body: ClinicalAnalyzeRequest) => void;
  /** Cancela el stream activo (si lo hay) y limpia la timeline. */
  reset: () => void;
}

export function useClinicalAnalyze(): UseClinicalAnalyzeResult {
  const [entries, setEntries] = useState<ClinicalAnalyzeEntry[]>([]);
  const [status, setStatus] = useState<ClinicalAnalyzeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Ref en vez de state — cambiar la suscripción no debe disparar render.
  const subscriptionRef = useRef<ClinicalAnalyzeSubscription | null>(null);

  const closeActive = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(
    (body: ClinicalAnalyzeRequest) => {
      // Si había un stream corriendo, lo cerramos antes de arrancar otro.
      closeActive();

      setEntries([]);
      setError(null);
      setStatus('streaming');

      subscriptionRef.current = subscribeToClinicalAnalyze(body, {
        onEvent: (event) => {
          // Cada evento se traduce en una entrada de la timeline. Los
          // tokens se "compactan": si el último entry ya es texto, le
          // concatenamos el nuevo trozo — así la UI muestra una única
          // burbuja que crece, no una por cada token.
          if (event.type === 'token') {
            setEntries((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === 'text') {
                return [
                  ...prev.slice(0, -1),
                  { kind: 'text', text: last.text + event.text },
                ];
              }
              return [...prev, { kind: 'text', text: event.text }];
            });
          } else if (event.type === 'tool_call') {
            setEntries((prev) => [
              ...prev,
              { kind: 'tool_call', medications: event.medications },
            ]);
          } else if (event.type === 'tool_result') {
            setEntries((prev) => [
              ...prev,
              { kind: 'tool_result', interactions: event.interactions },
            ]);
          } else if (event.type === 'done') {
            // El handler `onDone` del subscribe lo cierra; no hacemos nada acá.
          } else if (event.type === 'error_event') {
            setError(event.message);
            setStatus('error');
          }
        },
        onDone: () => {
          // No pisamos `error` si el stream terminó por una falla — chequeamos
          // el status actual con un updater para evitar leer stale state.
          setStatus((prev) => (prev === 'error' ? 'error' : 'done'));
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
    setEntries([]);
    setError(null);
    setStatus('idle');
  }, [closeActive]);

  // Cleanup al desmontar.
  useEffect(() => {
    return () => {
      closeActive();
    };
  }, [closeActive]);

  return { entries, status, error, start, reset };
}
