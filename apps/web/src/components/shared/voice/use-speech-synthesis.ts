// -----------------------------------------------------------------------------
// useSpeechSynthesis — wrapper React del speechSynthesis del browser (TTS).
//
// Hook shared entre demos. Cada caller pasa su lang preferido:
//   - tutor (Demo 05): 'en-US' (el tutor habla inglés).
//   - clínico (Demo 06): 'es-ES' / 'es-MX' (el asistente le habla al médico
//     en español).
//   - avatar HR (Demo 07): según el rol de la entrevista.
//
// La API del browser es estándar y bien soportada (Chrome/Safari/Firefox).
// Usamos:
//   - speechSynthesis.speak(utterance) para reproducir.
//   - speechSynthesis.cancel() para cortar lo que esté hablando.
//
// Voice selection: el browser lista voces vía `getVoices()`. La carga es
// asíncrona en algunos browsers (Chrome dispara `voiceschanged`). Tomamos
// la primera voz que matchee el lang exacto; si no, una con el mismo prefijo
// ('es-' para 'es-MX'); si nada, dejamos al browser elegir.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasSpeechSynthesis } from './web-speech-types';

const DEFAULT_LANG = 'en-US';
const DEFAULT_RATE = 0.95;
const DEFAULT_PITCH = 1.0;

export interface UseSpeechSynthesisOptions {
  /** BCP-47 tag. Default 'en-US' por compat con el primer caller. */
  lang?: string;
  /** Velocidad de reproducción. 0.1–10. Default 0.95 (un toque más lento). */
  rate?: number;
  /** Tono de voz. 0–2. Default 1.0. */
  pitch?: number;
}

export interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  /** Habla el texto. Si había algo hablando, lo cancela primero. */
  speak: (text: string) => void;
  /** Corta lo que esté hablando (idempotente si no hay nada). */
  cancel: () => void;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisResult {
  const lang = options.lang ?? DEFAULT_LANG;
  const rate = options.rate ?? DEFAULT_RATE;
  const pitch = options.pitch ?? DEFAULT_PITCH;

  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!hasSpeechSynthesis()) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    // Match estrategia: 1) exacto por lang, 2) prefijo (ej 'es-' para 'es-MX'
    // si pedimos 'es-ES'), 3) ninguna y dejamos al browser decidir.
    function loadVoice() {
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = lang.split('-')[0];
      const exact = voices.find((v) => v.lang === lang);
      const fallback = voices.find((v) => v.lang.startsWith(langPrefix));
      voiceRef.current = exact ?? fallback ?? null;
    }

    loadVoice();
    // Chrome carga las voces de forma async — escuchamos voiceschanged.
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoice);
      // Cleanup: cancelamos cualquier utterance pendiente al desmontar.
      window.speechSynthesis.cancel();
    };
  }, [lang]);

  const speak = useCallback(
    (text: string) => {
      if (!hasSpeechSynthesis()) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      // Si había algo hablando, lo cortamos antes de empezar el nuevo.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [lang, rate, pitch],
  );

  const cancel = useCallback(() => {
    if (!hasSpeechSynthesis()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Memoizamos para que la identidad del objeto solo cambie cuando uno de
  // sus valores cambia. Sin esto, el consumer que ponga `synthesis` en las
  // deps de un useEffect dispara ese effect en cada render — bug que causó
  // un loop infinito en /demo/clinical al disparar reset()+setState en cada
  // ciclo y dejar la UI congelada (junio 2026).
  return useMemo(
    () => ({ isSupported, isSpeaking, speak, cancel }),
    [isSupported, isSpeaking, speak, cancel],
  );
}
