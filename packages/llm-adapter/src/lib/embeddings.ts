// -----------------------------------------------------------------------------
// Singleton del EmbeddingsAdapter, configurado desde env vars al primer uso.
// Mismo patrón lazy que chat.ts (ver allí el detalle del "por qué lazy").
// -----------------------------------------------------------------------------

import { FakeEmbeddingsAdapter } from './providers/fake-embeddings.js';
import { OpenAIEmbeddingsAdapter } from './providers/openai-embeddings.js';
import { PrivateMacEmbeddingsAdapter } from './providers/private-mac-embeddings.js';
import type { EmbeddingsAdapter, EmbeddingsConfig } from './types.js';

export function readEmbeddingsConfig(): EmbeddingsConfig {
  const provider = process.env.EMBEDDINGS_PROVIDER;
  if (!provider) {
    throw new Error('EMBEDDINGS_PROVIDER no está definida en el entorno.');
  }
  if (
    provider !== 'openai' &&
    provider !== 'openai-compat' &&
    provider !== 'private-mac' &&
    provider !== 'fake'
  ) {
    throw new Error(
      `EMBEDDINGS_PROVIDER inválido: "${provider}". Esperado: 'openai', 'openai-compat', 'private-mac' o 'fake'.`,
    );
  }

  // Provider 'fake': no exigimos credenciales (ver comentario análogo en
  // chat.ts). Placeholders para satisfacer el shape; el adapter los ignora.
  if (provider === 'fake') {
    return {
      provider: 'fake',
      apiKey: 'fake',
      model: process.env.EMBEDDINGS_MODEL ?? 'fake-model',
    };
  }

  const apiKey =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_API_KEY ?? process.env.EMBEDDINGS_API_KEY)
      : process.env.EMBEDDINGS_API_KEY;
  if (!apiKey) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_API_KEY/EMBEDDINGS_API_KEY no está definida en el entorno.'
        : 'EMBEDDINGS_API_KEY no está definida en el entorno.',
    );
  }

  const model =
    provider === 'private-mac'
      ? (process.env.PRIVATE_EMBEDDING_MODEL ?? process.env.EMBEDDINGS_MODEL)
      : process.env.EMBEDDINGS_MODEL;
  if (!model) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_EMBEDDING_MODEL/EMBEDDINGS_MODEL no está definida en el entorno.'
        : 'EMBEDDINGS_MODEL no está definida en el entorno.',
    );
  }

  const baseUrl =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_BASE_URL ?? process.env.EMBEDDINGS_BASE_URL)
      : process.env.EMBEDDINGS_BASE_URL;
  if (
    (provider === 'openai-compat' || provider === 'private-mac') &&
    !baseUrl
  ) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_BASE_URL/EMBEDDINGS_BASE_URL es obligatoria cuando EMBEDDINGS_PROVIDER=private-mac.'
        : 'EMBEDDINGS_BASE_URL es obligatoria cuando EMBEDDINGS_PROVIDER=openai-compat.',
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
    case 'private-mac':
      return new PrivateMacEmbeddingsAdapter({
        ...config,
        demoName: process.env.PRIVATE_LLM_DEMO_NAME,
        timeoutMs: Number(process.env.PRIVATE_LLM_TIMEOUT_MS ?? 120000),
      });
    case 'fake':
      return new FakeEmbeddingsAdapter(config);
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
