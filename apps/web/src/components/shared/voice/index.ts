// Barrel del módulo de voz compartido. Cualquier demo que quiera voz
// importa de aquí en vez de tocar paths internos. Cuando entren más
// helpers (visualización de waveform, push-to-talk, etc.) se agregan acá.

export {
  useSpeechRecognition,
  type UseSpeechRecognitionOptions,
  type UseSpeechRecognitionResult,
} from './use-speech-recognition';

export {
  useSpeechSynthesis,
  type UseSpeechSynthesisOptions,
  type UseSpeechSynthesisResult,
} from './use-speech-synthesis';

export {
  getSpeechRecognitionCtor,
  hasSpeechSynthesis,
  type SpeechRecognitionInstance,
} from './web-speech-types';
