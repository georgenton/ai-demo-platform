// Tests del validador de env vars.
//
// Cubren:
//   - Configuración mínima válida (Anthropic + OpenAI) → ok.
//   - Configuración openai-compat sin BASE_URL → falla con mensaje claro.
//   - Provider inválido → falla con la lista de valores aceptados.
//   - Falta CHAT_API_KEY → falla mencionando el campo.
//   - PORT viene como string (process.env real) → se transforma a número.

import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema.js';

const VALID = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/d?schema=public',
  CHAT_PROVIDER: 'anthropic',
  CHAT_API_KEY: 'sk-ant-xxx',
  CHAT_MODEL: 'claude-sonnet-4',
  EMBEDDINGS_PROVIDER: 'openai',
  EMBEDDINGS_API_KEY: 'sk-openai-xxx',
  EMBEDDINGS_MODEL: 'text-embedding-3-small',
  // Auth (ADR-0014): 32+ chars obligatorios.
  JWT_SECRET: 'test-secret-just-for-validators-32-chars-min',
};

describe('validateEnv', () => {
  it('acepta la configuración mínima válida (Anthropic + OpenAI)', () => {
    expect(() => validateEnv(VALID)).not.toThrow();
  });

  it('exige CHAT_BASE_URL cuando CHAT_PROVIDER=openai-compat', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'openai-compat',
        // CHAT_BASE_URL ausente
      }),
    ).toThrow(/CHAT_BASE_URL/);
  });

  it('acepta openai-compat con BASE_URL válida', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'openai-compat',
        CHAT_BASE_URL: 'http://nai.local:8080/v1',
      }),
    ).not.toThrow();
  });

  it('acepta private-mac usando PRIVATE_LLM_*', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'private-mac',
        EMBEDDINGS_PROVIDER: 'private-mac',
        CHAT_API_KEY: undefined,
        CHAT_MODEL: undefined,
        EMBEDDINGS_API_KEY: undefined,
        EMBEDDINGS_MODEL: undefined,
        PRIVATE_LLM_BASE_URL: 'https://private-llm.millenialsoft.com',
        PRIVATE_LLM_API_KEY: 'demo-key',
        PRIVATE_LLM_MODEL: 'qwen2.5:7b',
        PRIVATE_EMBEDDING_MODEL: 'nomic-embed-text',
      }),
    ).not.toThrow();
  });

  it('acepta private-onprem usando ONPREM_LLM_* (ADR-0022)', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'private-onprem',
        EMBEDDINGS_PROVIDER: 'private-onprem',
        CHAT_API_KEY: undefined,
        CHAT_MODEL: undefined,
        EMBEDDINGS_API_KEY: undefined,
        EMBEDDINGS_MODEL: undefined,
        ONPREM_LLM_BASE_URL: 'http://ubuntu-onprem.local:11434',
        ONPREM_LLM_API_KEY: 'ollama-local',
        ONPREM_LLM_MODEL: 'llama3.2:3b',
        ONPREM_EMBEDDING_MODEL: 'nomic-embed-text',
      }),
    ).not.toThrow();
  });

  it('rechaza private-onprem sin ONPREM_LLM_BASE_URL con mensaje claro', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'private-onprem',
        CHAT_API_KEY: undefined,
        CHAT_MODEL: undefined,
        ONPREM_LLM_API_KEY: 'ollama-local',
        ONPREM_LLM_MODEL: 'llama3.2:3b',
      }),
    ).toThrow(/ONPREM_LLM_BASE_URL/);
  });

  it('rechaza CHAT_PROVIDER fuera del enum con mensaje útil', () => {
    expect(() => validateEnv({ ...VALID, CHAT_PROVIDER: 'cohere' })).toThrow(
      /CHAT_PROVIDER.*anthropic.*openai-compat.*private-mac.*private-onprem.*fake/,
    );
  });

  it('acepta fake sin CHAT_API_KEY/CHAT_MODEL ni EMBEDDINGS_*', () => {
    // Smoke local / CI: el adapter fake no necesita keys ni modelos reales.
    // El env.schema debe permitir arrancar el server con todo en fake.
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID.DATABASE_URL,
        JWT_SECRET: VALID.JWT_SECRET,
        CHAT_PROVIDER: 'fake',
        EMBEDDINGS_PROVIDER: 'fake',
        // sin CHAT_API_KEY, CHAT_MODEL, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL
      }),
    ).not.toThrow();
  });

  it('acepta combinaciones mixtas: chat fake + embeddings openai', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CHAT_PROVIDER: 'fake',
        CHAT_API_KEY: undefined,
        CHAT_MODEL: undefined,
        // EMBEDDINGS_* siguen siendo openai del baseline.
      }),
    ).not.toThrow();
  });

  it('rechaza si falta CHAT_API_KEY mencionando el campo', () => {
    const { CHAT_API_KEY: _omit, ...withoutKey } = VALID;
    void _omit;
    expect(() => validateEnv(withoutKey)).toThrow(/CHAT_API_KEY/);
  });

  it('transforma PORT de string a número (process.env real lo manda como string)', () => {
    const result = validateEnv({ ...VALID, PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('rechaza PORT fuera de rango (0)', () => {
    expect(() => validateEnv({ ...VALID, PORT: '0' })).toThrow(/PORT/);
  });
});
