// -----------------------------------------------------------------------------
// useEstimatedCost — hook compartido para los Demos 01/02/03/04.
//
// Por qué estimación en vez de tokens reales:
//   - El LLMAdapter expone `completeStreamWithUsage` (PR-B del Demo 05) que
//     devuelve tokens exactos, pero migrar los 4 demos viejos a ese método
//     implica tocar 4 backends + 4 controllers + 4 hooks. Demasiado costo
//     por una pieza que el cliente NO audita al token.
//   - La heurística estándar de la industria (Anthropic y OpenAI la
//     documentan) es ~4 chars/token para inglés/español. Para un contraste
//     visual "esto te cuesta $X en Anthropic, $0 en NAI", alcanza.
//   - Si en algún momento alguien exige tokens exactos (CIO afilado), se
//     hace el refactor de los 4 endpoints y este hook desaparece.
//
// Cómo se usa:
//   const cost = useEstimatedCost();
//   cost.addInput(promptText);   // texto que vamos a mandar al LLM
//   cost.addOutput(streamedTok); // cada token o chunk del stream
//   cost.reset();                // cuando el usuario "limpia" la sesión
//
// El hook acumula chars; el render lo divide por 4 al mostrar tokens.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface EstimatedUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface UseEstimatedCostResult extends EstimatedUsage {
  addInput: (text: string) => void;
  addOutput: (text: string) => void;
  /** Resetea el contador. Útil cuando el usuario reinicia la conversación. */
  reset: () => void;
}

/** Misma constante que el FakeChatAdapter — coherencia entre estimaciones. */
const CHARS_PER_TOKEN = 4;

/**
 * Pure helper: chars → tokens estimados.
 *
 * Exportado para que los tests cubran la heurística sin tener que montar
 * el hook completo en testing-library. La regla de la industria
 * (Anthropic + OpenAI la documentan en sus guides de pricing) es ~4
 * chars/token para inglés y español.
 */
export function estimateTokens(chars: number): number {
  return Math.max(0, Math.round(chars / CHARS_PER_TOKEN));
}

export function useEstimatedCost(): UseEstimatedCostResult {
  const [inputChars, setInputChars] = useState(0);
  const [outputChars, setOutputChars] = useState(0);

  const addInput = useCallback((text: string) => {
    setInputChars((c) => c + text.length);
  }, []);
  const addOutput = useCallback((text: string) => {
    setOutputChars((c) => c + text.length);
  }, []);
  const reset = useCallback(() => {
    setInputChars(0);
    setOutputChars(0);
  }, []);

  return {
    inputTokens: estimateTokens(inputChars),
    outputTokens: estimateTokens(outputChars),
    addInput,
    addOutput,
    reset,
  };
}

/**
 * Helper auxiliar: observa un texto que crece (el `text` que devuelven los
 * hooks de stream tipo useChatStream / useAgentStream) y llama a `onDelta`
 * solo con los chars nuevos. Cuando el texto vuelve a 0 (reset de la
 * conversación), también resetea el contador interno.
 *
 * Pensado para encadenar a un `useEstimatedCost`:
 *
 *   const cost = useEstimatedCost();
 *   const { text } = useChatStream();
 *   useTextDelta(text, cost.addOutput);
 */
export function useTextDelta(
  text: string,
  onDelta: (chunk: string) => void,
): void {
  const lastLengthRef = useRef(0);
  useEffect(() => {
    if (text.length > lastLengthRef.current) {
      onDelta(text.slice(lastLengthRef.current));
      lastLengthRef.current = text.length;
    } else if (text.length === 0) {
      lastLengthRef.current = 0;
    }
  }, [text, onDelta]);
}
