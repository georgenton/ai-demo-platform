// -----------------------------------------------------------------------------
// Tests del módulo embeddings.ts (mismo patrón que chat.test.ts).
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';

import { createEmbeddingsAdapter, readEmbeddingsConfig } from './embeddings.js';
import { OpenAIEmbeddingsAdapter } from './providers/openai-embeddings.js';

describe('readEmbeddingsConfig', () => {
  beforeEach(() => {
    delete process.env.EMBEDDINGS_PROVIDER;
    delete process.env.EMBEDDINGS_API_KEY;
    delete process.env.EMBEDDINGS_MODEL;
    delete process.env.EMBEDDINGS_BASE_URL;
  });

  it('lanza si EMBEDDINGS_PROVIDER no está definida', () => {
    expect(() => readEmbeddingsConfig()).toThrow(/EMBEDDINGS_PROVIDER/);
  });

  it('lanza si EMBEDDINGS_PROVIDER tiene un valor no soportado', () => {
    process.env.EMBEDDINGS_PROVIDER = 'cohere';
    process.env.EMBEDDINGS_API_KEY = 'sk-fake';
    process.env.EMBEDDINGS_MODEL = 'm';
    expect(() => readEmbeddingsConfig()).toThrow(
      /EMBEDDINGS_PROVIDER inválido/,
    );
  });

  it('lanza si falta EMBEDDINGS_API_KEY', () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai';
    process.env.EMBEDDINGS_MODEL = 'text-embedding-3-small';
    expect(() => readEmbeddingsConfig()).toThrow(/EMBEDDINGS_API_KEY/);
  });

  it('lanza si falta EMBEDDINGS_MODEL', () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai';
    process.env.EMBEDDINGS_API_KEY = 'sk-fake';
    expect(() => readEmbeddingsConfig()).toThrow(/EMBEDDINGS_MODEL/);
  });

  it('lanza si openai-compat sin EMBEDDINGS_BASE_URL', () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai-compat';
    process.env.EMBEDDINGS_API_KEY = 'sk-fake';
    process.env.EMBEDDINGS_MODEL = 'bge-large';
    expect(() => readEmbeddingsConfig()).toThrow(/EMBEDDINGS_BASE_URL/);
  });

  it('devuelve config válida con provider=openai', () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai';
    process.env.EMBEDDINGS_API_KEY = 'sk-fake';
    process.env.EMBEDDINGS_MODEL = 'text-embedding-3-small';
    expect(readEmbeddingsConfig()).toEqual({
      provider: 'openai',
      apiKey: 'sk-fake',
      model: 'text-embedding-3-small',
      baseUrl: undefined,
    });
  });

  it('devuelve config válida con provider=openai-compat + baseUrl', () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai-compat';
    process.env.EMBEDDINGS_API_KEY = 'sk-fake';
    process.env.EMBEDDINGS_MODEL = 'bge-large';
    process.env.EMBEDDINGS_BASE_URL = 'http://nai:8080/v1';
    expect(readEmbeddingsConfig()).toEqual({
      provider: 'openai-compat',
      apiKey: 'sk-fake',
      model: 'bge-large',
      baseUrl: 'http://nai:8080/v1',
    });
  });
});

describe('createEmbeddingsAdapter', () => {
  // OpenAI y openai-compat usan el MISMO adapter (la diferencia es el baseURL).
  // Verificamos que ambos providers devuelvan la misma clase.
  it('devuelve OpenAIEmbeddingsAdapter para provider="openai"', () => {
    const adapter = createEmbeddingsAdapter({
      provider: 'openai',
      apiKey: 'sk-fake',
      model: 'text-embedding-3-small',
    });
    expect(adapter).toBeInstanceOf(OpenAIEmbeddingsAdapter);
  });

  it('devuelve OpenAIEmbeddingsAdapter para provider="openai-compat"', () => {
    const adapter = createEmbeddingsAdapter({
      provider: 'openai-compat',
      apiKey: 'sk-fake',
      model: 'bge-large',
      baseUrl: 'http://nai:8080/v1',
    });
    expect(adapter).toBeInstanceOf(OpenAIEmbeddingsAdapter);
  });
});
