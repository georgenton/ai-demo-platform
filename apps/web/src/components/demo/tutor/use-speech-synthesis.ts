// -----------------------------------------------------------------------------
// useSpeechSynthesis — wrapper React del speechSynthesis del browser (TTS).
//
// La API es estándar y bien soportada (Chrome/Safari/Firefox). Usamos:
//   - speechSynthesis.speak(utterance) para reproducir.
//   - speechSynthesis.cancel() para cortar lo que esté hablando.
//
// Configuramos cada utterance con:
//   - lang  = 'en-US' (el tutor habla inglés).
//   - rate  = 0.95     (un poco más lento — ayuda al aprendiz).
//   - pitch = 1.0      (default).
//
// Voice selection: el browser lista voces vía `getVoices()`. La carga es
// asíncrona en algunos browsers (Chrome dispara `voiceschanged`). Tomamos
// la primera voz `en-US` disponible; si no hay, dejamos al browser elegir.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { hasSpeechSynthesis } from './web-speech-types';

export interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  /** Habla el texto. Si había algo hablando, lo cancela primero. */
  speak: (text: string) => void;
  /** Corta lo que esté hablando (idempotente si no hay nada). */
  cancel: () => void;
}

const PREFERRED_LANG = 'en-US';

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!hasSpeechSynthesis()) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    function loadVoice() {
      const voices = window.speechSynthesis.getVoices();
      // Preferimos voces 'en-US'. Si no hay, cualquier 'en-*'. Si nada,
      // dejamos voiceRef en null y la utterance usa el default del browser.
      const exact = voices.find((v) => v.lang === PREFERRED_LANG);
      const fallback = voices.find((v) => v.lang.startsWith('en'));
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
  }, []);

  const speak = useCallback((text: string) => {
    if (!hasSpeechSynthesis()) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Si había algo hablando, lo cortamos antes de empezar el nuevo.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = PREFERRED_LANG;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    if (voiceRef.current) utterance.voice = voiceRef.current;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (!hasSpeechSynthesis()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSupported, isSpeaking, speak, cancel };
}
