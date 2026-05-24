// -----------------------------------------------------------------------------
// Singleton del EmbeddingsAdapter, configurado desde env vars al primer uso.
// Mismo patrón lazy que chat.ts (ver allí el detalle del "por qué lazy").
// -----------------------------------------------------------------------------

import { OpenAIEmbeddingsAdapter } from './providers/openai-embeddings.js';
import type { EmbeddingsAdapter, EmbeddingsConfig } from './types.js';

export function readEmbeddingsConfig(): EmbeddingsConfig {
  const provider = process.env.EMBEDDINGS_PROVIDER;
  if (!provider) {
    throw new Error('EMBEDDINGS_PROVIDER no está definida en el entorno.');
  }
  if (provider !== 'openai' && provider !== 'openai-compat') {
    throw new Error(
      `EMBEDDINGS_PROVIDER inválido: "${provider}". Esperado: 'openai' o 'openai-compat'.`,
    );
  }

  const apiKey = process.env.EMBEDDINGS_API_KEY;
  if (!apiKey) {
    throw new Error('EMBEDDINGS_API_KEY no está definida en el entorno.');
  }

  const model = process.env.EMBEDDINGS_MODEL;
  if (!model) {
    throw new Error('EMBEDDINGS_MODEL no está definida en el entorno.');
  }

  const baseUrl = process.env.EMBEDDINGS_BASE_URL;
  if (provider === 'openai-compat' && !baseUrl) {
    throw new Error(
      'EMBEDDINGS_BASE_URL es obligatoria cuando EMBEDDINGS_PROVIDER=openai-compat.',
    );
  }

  return { provider, apiKey, model, baseUrl };
}

export function createEmbeddingsAdapter(
  config: EmbeddingsConfig,
): EmbeddingsAdapter {
  switch (config.provider) {
    case 'openai':
    case 'openai-compat':
      // El mismo adapter sirve para OpenAI nativo y para endpoints
      // OpenAI-compatible (NAI). La diferencia es solo el baseURL del cliente.
      return new OpenAIEmbeddingsAdapter(config);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Provider no manejado: ${String(_exhaustive)}`);
    }
  }
}

let _instance: EmbeddingsAdapter | undefined;

function getEmbeddings(): EmbeddingsAdapter {
  if (!_instance) {
    _instance = createEmbeddingsAdapter(readEmbeddingsConfig());
  }
  return _instance;
}

/**
 * Singleton del EmbeddingsAdapter — la "puerta" de los embeddings.
 *
 * @example
 *   import { embeddings } from '@org/llm-adapter';
 *   const vector = await embeddings.embed('una pregunta');
 *   const vectors = await embeddings.embedMany(['chunk a', 'chunk b']);
 */
export const embeddings: EmbeddingsAdapter = {
  embed(text) {
    return getEmbeddings().embed(text);
  },
  embedMany(texts) {
    return getEmbeddings().embedMany(texts);
  },
};
