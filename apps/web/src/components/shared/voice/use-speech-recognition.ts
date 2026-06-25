// -----------------------------------------------------------------------------
// useSpeechRecognition — wrapper React de la Web Speech API (voice input).
//
// Hook shared entre demos: tutor (Demo 05) habla inglés, clínico (Demo 06)
// español, avatar HR (Demo 07) puede ser español o inglés según el rol.
// Por eso `lang` se acepta como opción con default 'en-US' (compatibilidad
// con el primer caller — el tutor).
//
// Comportamiento:
//   - lang configurable. Default 'en-US' por el caller original.
//   - continuous = false. Una "frase" por click; cuando el usuario hace una
//     pausa, el reconocedor cierra y el hook expone `transcript`.
//   - interimResults = true. Mientras habla, vamos actualizando un buffer
//     parcial (no-final). Cuando llega el final, `transcript` queda fijo.
//
// El consumer puede leer:
//   - `isListening`         — el botón mic se pinta "on".
//   - `interimTranscript`   — texto parcial mientras habla (preview).
//   - `transcript`          — texto final cuando la API confirma la frase.
//   - `isSupported`         — false en Firefox / browsers sin la API.
//   - `error`               — string legible cuando falla.
//
// El consumer llama:
//   - `start()` — pide permiso de mic (la primera vez) y abre el stream.
//   - `stop()`  — corta limpio. Si había transcript parcial, lo deja en
//                  `transcript` como definitivo.
//   - `reset()` — limpia transcript + interim + error (después de mandar
//                  el mensaje, para empezar fresh).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionInstance,
} from './web-speech-types';

const DEFAULT_LANG = 'en-US';

export interface UseSpeechRecognitionOptions {
  /** BCP-47 tag. Default 'en-US' por compatibilidad con el primer caller. */
  lang?: string;
}

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const lang = options.lang ?? DEFAULT_LANG;
  // Una sola instancia por hook; se reusa entre start/stop. Si la quemamos
  // y creamos una nueva en cada start, Chrome a veces deja el mic colgado.
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Inicialización lazy — solo en cliente y solo si el browser soporta.
  // El efecto depende de `lang` así que recrear la instancia si cambia el
  // idioma. En la práctica esto pasa cuando el user cambia el switch ES/EN
  // del header — mejor que mute en vivo que tener un lang "viejo".
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      // Recorremos los resultados nuevos desde resultIndex (lo anterior ya
      // se concatenó en transcript). Separamos final vs interim.
      let finalAdd = '';
      let interimAdd = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalAdd += result[0].transcript;
        } else {
          interimAdd += result[0].transcript;
        }
      }
      if (finalAdd) {
        setTranscript((prev) =>
          prev ? prev + ' ' + finalAdd.trim() : finalAdd.trim(),
        );
        setInterimTranscript('');
      } else if (interimAdd) {
        setInterimTranscript(interimAdd);
      }
    };

    rec.onerror = (event) => {
      // Errores comunes: 'no-speech' (silencio), 'not-allowed' (permiso
      // denegado), 'audio-capture' (sin mic), 'network' (rara vez).
      // Para 'no-speech' no mostramos error — el usuario simplemente
      // no habló; el listener se cierra solo.
      if (event.error === 'no-speech') return;
      setError(humanizeError(event.error));
      setIsListening(false);
    };

    rec.onend = () => {
      // Se llama cuando termina por timeout, stop(), o error.
      setIsListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      // Cleanup en unmount: abort por las dudas.
      try {
        rec.abort();
      } catch {
        // Si ya estaba cerrado, ignoramos.
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    try {
      rec.start();
      setIsListening(true);
    } catch (err) {
      // start() tira si ya estaba activo. Lo silenciamos — el botón debería
      // estar deshabilitado en ese estado, pero ante un doble-click rápido
      // no queremos un crash.
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // Idempotente.
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  // Memoizamos el objeto retornado para que su identidad solo cambie cuando
  // alguno de los valores internos cambia. Sin esto, cada render del consumer
  // crea un objeto nuevo {...} con identidad distinta, y cualquier useEffect
  // del consumer que tenga `recognition` en sus deps se ejecuta cada render
  // — bug que congeló el demo clínico al disparar reset() en loop infinito
  // (junio 2026).
  return useMemo(
    () => ({
      isSupported,
      isListening,
      transcript,
      interimTranscript,
      error,
      start,
      stop,
      reset,
    }),
    [
      isSupported,
      isListening,
      transcript,
      interimTranscript,
      error,
      start,
      stop,
      reset,
    ],
  );
}

/**
 * Traduce el código crudo de error a algo más humano. Los mensajes están
 * en español porque tres de los demos potenciales (clínico, HR, helpdesk)
 * apuntan a usuarios hispanohablantes. El tutor (inglés) es la excepción
 * pero el error de mic igual se le muestra en español al usuario LATAM.
 */
function humanizeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permiso del micrófono denegado. Habilítalo en la barra del navegador.';
    case 'audio-capture':
      return 'No se detectó un micrófono en este equipo.';
    case 'network':
      return 'Error de red al conectar con el reconocedor de voz.';
    default:
      return `Error de reconocimiento de voz: ${code}`;
  }
}
