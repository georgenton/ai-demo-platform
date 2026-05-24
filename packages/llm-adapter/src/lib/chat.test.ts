// -----------------------------------------------------------------------------
// Tests del módulo chat.ts.
//
// Cubrimos las dos partes "puras" del módulo:
//   - readChatConfig(): validación estricta de env vars + mensajes claros.
//   - createChatAdapter(): selección de la clase concreta según el provider.
//
// No tocamos el singleton `chat` directamente (su caché a nivel de módulo
// es difícil de testear sin re-imports dinámicos) ni hacemos llamadas reales
// a APIs externas. El SDK lo mockeamos en providers/openai-embeddings.test.ts
// como ejemplo de ese patrón.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';

import { createChatAdapter, readChatConfig } from './chat.js';
import { AnthropicChatAdapter } from './providers/anthropic-chat.js';
import { OpenAICompatChatAdapter } from './providers/openai-compat-chat.js';

describe('readChatConfig', () => {
  // Antes de cada test borramos las CHAT_* para empezar desde un estado limpio.
  // Cada test setea solo lo que necesita y verifica el comportamiento.
  beforeEach(() => {
    delete process.env.CHAT_PROVIDER;
    delete process.env.CHAT_API_KEY;
    delete process.env.CHAT_MODEL;
    delete process.env.CHAT_BASE_URL;
  });

  it('lanza un error claro si CHAT_PROVIDER no está definida', () => {
    expect(() => readChatConfig()).toThrow(/CHAT_PROVIDER/);
  });

  it('lanza si CHAT_PROVIDER tiene un valor no soportado', () => {
    process.env.CHAT_PROVIDER = 'cohere';
    process.env.CHAT_API_KEY = 'sk-fake';
    process.env.CHAT_MODEL = 'm';
    expect(() => readChatConfig()).toThrow(/CHAT_PROVIDER inválido/);
  });

  it('lanza si falta CHAT_API_KEY', () => {
    process.env.CHAT_PROVIDER = 'anthropic';
    process.env.CHAT_MODEL = 'claude-sonnet-4';
    expect(() => readChatConfig()).toThrow(/CHAT_API_KEY/);
  });

  it('lanza si falta CHAT_MODEL', () => {
    process.env.CHAT_PROVIDER = 'anthropic';
    process.env.CHAT_API_KEY = 'sk-fake';
    expect(() => readChatConfig()).toThrow(/CHAT_MODEL/);
  });

  it('lanza si openai-compat sin CHAT_BASE_URL', () => {
    process.env.CHAT_PROVIDER = 'openai-compat';
    process.env.CHAT_API_KEY = 'sk-fake';
    process.env.CHAT_MODEL = 'llama-3';
    expect(() => readChatConfig()).toThrow(/CHAT_BASE_URL/);
  });

  it('devuelve config válida con provider=anthropic', () => {
    process.env.CHAT_PROVIDER = 'anthropic';
    process.env.CHAT_API_KEY = 'sk-fake';
    process.env.CHAT_MODEL = 'claude-sonnet-4';
    expect(readChatConfig()).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-fake',
      model: 'claude-sonnet-4',
      baseUrl: undefined,
    });
  });

  it('devuelve config válida con provider=openai-compat + baseUrl', () => {
    process.env.CHAT_PROVIDER = 'openai-compat';
    process.env.CHAT_API_KEY = 'sk-fake';
    process.env.CHAT_MODEL = 'meta/llama-3.1-70b-instruct';
    process.env.CHAT_BASE_URL = 'http://nai:8080/v1';
    expect(readChatConfig()).toEqual({
      provider: 'openai-compat',
      apiKey: 'sk-fake',
      model: 'meta/llama-3.1-70b-instruct',
      baseUrl: 'http://nai:8080/v1',
    });
  });
});

describe('createChatAdapter', () => {
  it('devuelve AnthropicChatAdapter para provider="anthropic"', () => {
    const adapter = createChatAdapter({
      provider: 'anthropic',
      apiKey: 'sk-fake',
      model: 'claude-sonnet-4',
    });
    expect(adapter).toBeInstanceOf(AnthropicChatAdapter);
  });

  it('devuelve OpenAICompatChatAdapter para provider="openai-compat"', () => {
    const adapter = createChatAdapter({
      provider: 'openai-compat',
      apiKey: 'sk-fake',
      model: 'meta/llama-3.1-70b-instruct',
      baseUrl: 'http://nai:8080/v1',
    });
    expect(adapter).toBeInstanceOf(OpenAICompatChatAdapter);
  });
});
