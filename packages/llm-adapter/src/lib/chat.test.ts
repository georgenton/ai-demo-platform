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
import { FakeChatAdapter } from './providers/fake-chat.js';
import { OpenAICompatChatAdapter } from './providers/openai-compat-chat.js';
import { PrivateMacChatAdapter } from './providers/private-mac-chat.js';
import { PrivateOnpremChatAdapter } from './providers/private-onprem-chat.js';

describe('readChatConfig', () => {
  // Antes de cada test borramos las CHAT_* para empezar desde un estado limpio.
  // Cada test setea solo lo que necesita y verifica el comportamiento.
  beforeEach(() => {
    delete process.env.CHAT_PROVIDER;
    delete process.env.CHAT_API_KEY;
    delete process.env.CHAT_MODEL;
    delete process.env.CHAT_BASE_URL;
    delete process.env.PRIVATE_LLM_BASE_URL;
    delete process.env.PRIVATE_LLM_API_KEY;
    delete process.env.PRIVATE_LLM_MODEL;
    delete process.env.ONPREM_LLM_BASE_URL;
    delete process.env.ONPREM_LLM_API_KEY;
    delete process.env.ONPREM_LLM_MODEL;
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

  it('provider=fake no exige API key ni modelo — devuelve placeholders', () => {
    process.env.CHAT_PROVIDER = 'fake';
    // SIN CHAT_API_KEY, SIN CHAT_MODEL — deliberadamente.
    expect(readChatConfig()).toEqual({
      provider: 'fake',
      apiKey: 'fake',
      model: 'fake-model',
    });
  });

  it('provider=fake respeta CHAT_MODEL si se setea explícitamente', () => {
    process.env.CHAT_PROVIDER = 'fake';
    process.env.CHAT_MODEL = 'mi-modelo-custom';
    expect(readChatConfig().model).toBe('mi-modelo-custom');
  });

  it('devuelve config válida con provider=private-mac y variables PRIVATE_LLM_*', () => {
    process.env.CHAT_PROVIDER = 'private-mac';
    process.env.PRIVATE_LLM_BASE_URL = 'https://private-llm.example.com';
    process.env.PRIVATE_LLM_API_KEY = 'demo-key';
    process.env.PRIVATE_LLM_MODEL = 'qwen2.5:7b';
    expect(readChatConfig()).toEqual({
      provider: 'private-mac',
      apiKey: 'demo-key',
      model: 'qwen2.5:7b',
      baseUrl: 'https://private-llm.example.com',
    });
  });

  it('devuelve config válida con provider=private-onprem y variables ONPREM_LLM_* (ADR-0022)', () => {
    process.env.CHAT_PROVIDER = 'private-onprem';
    process.env.ONPREM_LLM_BASE_URL = 'http://ubuntu-onprem.local:11434';
    process.env.ONPREM_LLM_API_KEY = 'ollama-local';
    process.env.ONPREM_LLM_MODEL = 'llama3.2:3b';
    expect(readChatConfig()).toEqual({
      provider: 'private-onprem',
      apiKey: 'ollama-local',
      model: 'llama3.2:3b',
      baseUrl: 'http://ubuntu-onprem.local:11434',
    });
  });

  it('private-onprem usa fallback a CHAT_* si las ONPREM_LLM_* no están', () => {
    process.env.CHAT_PROVIDER = 'private-onprem';
    process.env.CHAT_API_KEY = 'fallback-key';
    process.env.CHAT_MODEL = 'fallback-model';
    process.env.CHAT_BASE_URL = 'http://fallback.local';
    expect(readChatConfig()).toEqual({
      provider: 'private-onprem',
      apiKey: 'fallback-key',
      model: 'fallback-model',
      baseUrl: 'http://fallback.local',
    });
  });

  it('private-onprem lanza si falta base URL (ni ONPREM_LLM_BASE_URL ni CHAT_BASE_URL)', () => {
    process.env.CHAT_PROVIDER = 'private-onprem';
    process.env.ONPREM_LLM_API_KEY = 'k';
    process.env.ONPREM_LLM_MODEL = 'm';
    expect(() => readChatConfig()).toThrow(
      /ONPREM_LLM_BASE_URL\/CHAT_BASE_URL/,
    );
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

  it('devuelve FakeChatAdapter para provider="fake"', () => {
    const adapter = createChatAdapter({
      provider: 'fake',
      apiKey: 'fake',
      model: 'fake-model',
    });
    expect(adapter).toBeInstanceOf(FakeChatAdapter);
  });

  it('devuelve PrivateMacChatAdapter para provider="private-mac"', () => {
    const adapter = createChatAdapter({
      provider: 'private-mac',
      apiKey: 'demo-key',
      model: 'qwen2.5:7b',
      baseUrl: 'https://private-llm.example.com',
    });
    expect(adapter).toBeInstanceOf(PrivateMacChatAdapter);
  });

  it('devuelve PrivateOnpremChatAdapter para provider="private-onprem"', () => {
    const adapter = createChatAdapter({
      provider: 'private-onprem',
      apiKey: 'ollama-key',
      model: 'llama3.2:3b',
      baseUrl: 'http://ubuntu-onprem.local:11434',
    });
    expect(adapter).toBeInstanceOf(PrivateOnpremChatAdapter);
  });
});
