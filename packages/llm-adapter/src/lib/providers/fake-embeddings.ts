// -----------------------------------------------------------------------------
// FakeEmbeddingsAdapter — devuelve embeddings determinísticos basados en
// "bag of words" sobre tokens del texto. Útil para tests E2E y CI sin keys.
//
// Por qué bag-of-words y no random:
//   - Random determinístico cumpliría "mismo texto → mismo vector", pero no
//     daría similarity > 0 entre textos parecidos. El retrieval del RAG no
//     funcionaría: una pregunta y su chunk relevante quedarían lejos.
//   - Bag-of-words da la propiedad mínima necesaria: textos que comparten
//     palabras quedan cerca por cosine similarity. No es semantic search
//     real (un sinónimo no matchea), pero alcanza para verificar el flujo
//     completo en tests determinísticos.
//
// Cómo funciona:
//   1) Tokenizamos el texto en palabras (minúsculas, alfanuméricas, sin stop
//      words obvias).
//   2) Cada token → índice en [0, DIM) vía hash. Sumamos 1 en ese índice.
//   3) Normalizamos a vector unitario (cosine = dot product entre unit vectors).
//
// Dimensión: 768 — la misma que `nomic-embed-text` servido por NAI on-prem
// (ver ADR-0018, que superó al ADR-0008). Igualar la dimensión es
// OBLIGATORIO porque pgvector valida que el vector insertado coincida con
// `vector(768)` declarado en `Chunk.embedding`.
// -----------------------------------------------------------------------------

import type { EmbeddingsAdapter, EmbeddingsConfig } from '../types.js';

/** Dimensión que matchea la columna `vector(768)` en pgvector. */
const DIM = 768;

/** Stop words mínimas en es/en — sacamos solo las más ruidosas. No es nltk. */
const STOP_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'y',
  'o',
  'que',
  'qué',
  'a',
  'en',
  'es',
  'son',
  'por',
  'para',
  'con',
  'sin',
  'sobre',
  'al',
  'lo',
  'le',
  'su',
  'sus',
  'mi',
  'mis',
  'tu',
  'tus',
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'as',
  'be',
  'this',
  'that',
]);

/**
 * Hash simple djb2 — bastante uniforme para nuestro caso (mod DIM).
 * No necesitamos resistencia criptográfica, solo distribución decente.
 */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    // bit operations forzan int32 — sino TS/JS infla a float a partir de
    // ~2^53. La masking `>>> 0` al final lo deja unsigned.
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Tokeniza minimal: minúsculas, separa por no-alfanumérico, filtra cortos
 * y stop words. Es deliberadamente simple — el objetivo es coincidencia
 * exacta para tests, no NLP.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok));
}

/** Convierte un texto en un vector unitario de DIM dimensiones. */
function embedText(text: string): number[] {
  const vec = new Float64Array(DIM);
  const tokens = tokenize(text);

  // Si el texto no tiene tokens útiles (vacío, solo stop words), devolvemos
  // un vector con un único bit prendido para que no sea todo ceros (el
  // vector zero no tiene norma → cosine indefinido).
  if (tokens.length === 0) {
    vec[djb2(text) % DIM] = 1;
  } else {
    for (const tok of tokens) {
      vec[djb2(tok) % DIM] += 1;
    }
  }

  // Normalización L2 → vector unitario.
  let sumSq = 0;
  for (let i = 0; i < DIM; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1;

  // Devolvemos number[] (no Float64Array) para matchear la interfaz pública.
  const out = new Array<number>(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / norm;
  return out;
}

/**
 * Adapter de embeddings fake. La config se recibe por simetría con el real,
 * aunque no usemos ningún campo — así los tests pueden construirlo igual.
 */
export class FakeEmbeddingsAdapter implements EmbeddingsAdapter {
  constructor(_config: EmbeddingsConfig) {
    // Marker para que el linter no se queje de param sin usar.
    void _config;
  }

  async embed(text: string): Promise<number[]> {
    return embedText(text);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return texts.map(embedText);
  }
}
