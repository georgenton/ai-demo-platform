// -----------------------------------------------------------------------------
// EmbeddingService — wrapper sobre `embeddings` de @org/llm-adapter con
// concerns específicos del proyecto:
//   - Batching: las APIs de embeddings tienen un máximo de inputs por call.
//     Si recibimos 500 chunks, los partimos en lotes de N antes de mandarlos.
//   - (Futuro) caché de embeddings repetidos, reintentos con backoff, etc.
//
// Para embebidos sueltos no agrega nada — solo delega.
// -----------------------------------------------------------------------------

import { embeddings } from '@org/llm-adapter';

/**
 * Batch size por defecto. OpenAI permite hasta 2048 inputs por llamada;
 * 100 es conservador y predecible. Si cambia el proveedor, este número
 * podría necesitar ajuste.
 */
const DEFAULT_BATCH_SIZE = 100;

export class EmbeddingService {
  /**
   * Convierte un texto en un vector. Delega 1:1 al adapter.
   */
  async embed(text: string): Promise<number[]> {
    return embeddings.embed(text);
  }

  /**
   * Convierte muchos textos en vectores. Si el array es grande, lo parte
   * en lotes de `batchSize` para no superar los límites del proveedor.
   * El orden del output coincide con el del input.
   *
   * @param texts Textos a embebir (en orden).
   * @param batchSize Máximo de items por llamada al proveedor.
   */
  async embedMany(
    texts: string[],
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<number[][]> {
    if (batchSize <= 0) {
      throw new Error('EmbeddingService: batchSize debe ser > 0.');
    }
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const vectors = await embeddings.embedMany(batch);
      results.push(...vectors);
    }
    return results;
  }
}
