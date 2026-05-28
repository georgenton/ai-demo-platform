// -----------------------------------------------------------------------------
// Tipos mínimos de la Web Speech API.
//
// TypeScript NO incluye estos tipos en lib.dom.d.ts porque la spec sigue en
// Working Draft (https://wicg.github.io/speech-api/). Chrome/Safari la
// implementaron hace años bajo el prefijo webkit; Firefox aún no.
//
// Declaramos acá solo lo que usamos — no toda la spec. Si en algún momento
// necesitamos más eventos o métodos, se suman acá; el resto del frontend
// no debe tocar `window.webkitSpeechRecognition` directamente.
// -----------------------------------------------------------------------------

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

/**
 * Interfaz mínima de la clase SpeechRecognition (alias en navegadores reales:
 * window.SpeechRecognition o window.webkitSpeechRecognition).
 *
 * Solo declaramos los handlers/props que usamos. Los handlers se asignan
 * directamente (no son addEventListener) — comportamiento de la spec.
 */
export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

/**
 * Helper de feature detection. Devuelve el constructor (con o sin prefijo
 * webkit) o null si el browser no soporta.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Feature detection para Speech Synthesis. Más estable que SpeechRecognition
 * — Chrome/Safari/Firefox lo tienen sin prefijo.
 */
export function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
