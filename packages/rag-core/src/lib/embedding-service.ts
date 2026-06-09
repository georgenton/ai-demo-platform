// -----------------------------------------------------------------------------
// EmbeddingService — wrapper sobre `embeddings` de @org/llm-adapter con
// concerns específicos del proyecto:
//   - Batching: las APIs de embeddings tienen un máximo de inputs por call.
//     Si recibimos 500 chunks, los partimos en lotes de N antes de mandarlos.
//   - Provider override: cada llamada acepta opts.provider para respetar el
//     dropdown del header `X-LLM-Provider` (ver ADR-0018 + decorator
//     `@CurrentLlmProvider()` en apps/api).
//   - (Futuro) caché de embeddings repetidos, reintentos con backoff, etc.
//
// Para embebidos sueltos no agrega nada — solo delega al adapter.
// -----------------------------------------------------------------------------

import { embeddings, type EmbeddingsCallOptions } from '@org/llm-adapter';

/**
 * Batch size por defecto. OpenAI permite hasta 2048 inputs por llamada;
 * 100 es conservador y predecible. Si cambia el proveedor, este número
 * podría necesitar ajuste.
 */
const DEFAULT_BATCH_SIZE = 100;

export class EmbeddingService {
  /**
   * Convierte un texto en un vector. Delega 1:1 al adapter.
   *
   * @param text Texto a embebir.
   * @param opts Override del provider (`{ provider }`). Si se omite, usa el
   *   singleton del env (`EMBEDDINGS_PROVIDER`).
   */
  async embed(text: string, opts?: EmbeddingsCallOptions): Promise<number[]> {
    return embeddings.embed(text, opts);
  }

  /**
   * Convierte muchos textos en vectores. Si el array es grande, lo parte
   * en lotes de `batchSize` para no superar los límites del proveedor.
   * El orden del output coincide con el del input.
   *
   * @param texts Textos a embebir (en orden).
   * @param opts Override del provider (`{ provider }`) y/o `batchSize`. Si
   *   se omiten, usa el provider del env y batch=100.
   */
  async embedMany(
    texts: string[],
    opts?: EmbeddingsCallOptions & { batchSize?: number },
  ): Promise<number[][]> {
    const batchSize = opts?.batchSize ?? DEFAULT_BATCH_SIZE;
    if (batchSize <= 0) {
      throw new Error('EmbeddingService: batchSize debe ser > 0.');
    }
    if (texts.length === 0) return [];

    // Solo pasamos `provider` al adapter — `batchSize` es concern de este
    // wrapper, no del adapter de embeddings.
    const adapterOpts: EmbeddingsCallOptions | undefined = opts?.provider
      ? { provider: opts.provider }
      : undefined;

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const vectors = await embeddings.embedMany(batch, adapterOpts);
      results.push(...vectors);
    }
    return results;
  }
}
