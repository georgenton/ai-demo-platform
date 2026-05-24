// -----------------------------------------------------------------------------
// OpenAIEmbeddingsAdapter — implementación de EmbeddingsAdapter usando 'openai'.
//
// Funciona tanto con OpenAI nativo (api.openai.com) como con cualquier endpoint
// compatible OpenAI (NAI, LocalAI, vLLM, etc.) — la diferencia es solo el
// `baseURL` que se pasa al cliente.
// -----------------------------------------------------------------------------

import OpenAI from 'openai';

import type { EmbeddingsAdapter, EmbeddingsConfig } from '../types.js';

export class OpenAIEmbeddingsAdapter implements EmbeddingsAdapter {
  private readonly client: OpenAI;

  constructor(private readonly config: EmbeddingsConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      // Si baseUrl está definido (provider='openai-compat'), apuntamos ahí
      // (ej: NAI on-prem). Si no, el SDK usa api.openai.com por defecto.
      baseURL: config.baseUrl,
    });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.client.embeddings.create({
      model: this.config.model,
      input: text,
    });
    return result.data[0].embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    // El SDK acepta `input` como string[] — un solo HTTP call para N
    // embeddings. Mucho más eficiente que llamar `embed()` en loop.
    const result = await this.client.embeddings.create({
      model: this.config.model,
      input: texts,
    });
    return result.data.map((d) => d.embedding);
  }
}
