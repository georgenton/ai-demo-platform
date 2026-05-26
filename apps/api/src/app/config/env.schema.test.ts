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

  it('rechaza CHAT_PROVIDER fuera del enum con mensaje útil', () => {
    expect(() => validateEnv({ ...VALID, CHAT_PROVIDER: 'cohere' })).toThrow(
      /CHAT_PROVIDER.*anthropic.*openai-compat/,
    );
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
