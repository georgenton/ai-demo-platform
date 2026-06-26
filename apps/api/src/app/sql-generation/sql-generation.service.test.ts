// -----------------------------------------------------------------------------
// Tests de SqlGenerationService.
//
// Cubre:
//   - Devuelve null para Anthropic (no necesita pre-gen).
//   - Devuelve null si la env var del modelo SQL no está seteada.
//   - Llama al endpoint correcto para private-mac.
//   - Llama al endpoint correcto para private-onprem.
//   - Limpia fences ```sql del response.
//   - Devuelve null si el endpoint falla (no throwea).
//   - formatHintForLlm produce el formato esperado.
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SqlGenerationService } from './sql-generation.service.js';

describe('SqlGenerationService', () => {
  let svc: SqlGenerationService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    svc = new SqlGenerationService();
    fetchMock = vi.fn();
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    // Clean env entre tests.
    delete process.env.PRIVATE_LLM_SQL_MODEL;
    delete process.env.ONPREM_LLM_SQL_MODEL;
    delete process.env.PRIVATE_LLM_BASE_URL;
    delete process.env.PRIVATE_LLM_API_KEY;
    delete process.env.ONPREM_LLM_BASE_URL;
    delete process.env.ONPREM_LLM_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('devuelve null cuando provider=anthropic (no necesita pre-gen)', async () => {
    const result = await svc.generateIfAvailable({
      provider: 'anthropic',
      schema: 'CREATE TABLE t (id INT)',
      question: 'cuantas filas hay?',
      demoLabel: 'test',
    });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve null cuando provider=private-mac sin PRIVATE_LLM_SQL_MODEL', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'k';
    // SIN PRIVATE_LLM_SQL_MODEL deliberadamente.
    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'CREATE TABLE t (id INT)',
      question: 'foo',
      demoLabel: 'test',
    });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama al endpoint del Mac y devuelve SQL limpio sin fences', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'secret-key';
    process.env.PRIVATE_LLM_SQL_MODEL = 'sqlcoder:8b';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```sql\nSELECT COUNT(*) FROM "BiSocio"\n```',
            },
          },
        ],
      }),
    });

    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'CREATE TABLE "BiSocio" (id INT)',
      question: 'cuántos socios hay?',
      demoLabel: 'bi',
    });

    expect(result).toBe('SELECT COUNT(*) FROM "BiSocio"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://mac.local/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('sqlcoder:8b');
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.1);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('cuántos socios hay?');
    expect(init.headers.Authorization).toBe('Bearer secret-key');
  });

  it('llama al endpoint del Ubuntu cuando provider=private-onprem', async () => {
    process.env.ONPREM_LLM_BASE_URL = 'http://ubuntu.local';
    process.env.ONPREM_LLM_API_KEY = 'k';
    process.env.ONPREM_LLM_SQL_MODEL = 'defog-llama3-sqlcoder-8b';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'SELECT 1' } }],
      }),
    });

    const result = await svc.generateIfAvailable({
      provider: 'private-onprem',
      schema: 'CREATE TABLE t (id INT)',
      question: 'foo',
      demoLabel: 'agent',
    });

    expect(result).toBe('SELECT 1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ubuntu.local/v1/chat/completions');
  });

  it('devuelve null sin throwear cuando el endpoint responde 500', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'k';
    process.env.PRIVATE_LLM_SQL_MODEL = 'sqlcoder:8b';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    });

    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'x',
      question: 'y',
      demoLabel: 'bi',
    });
    expect(result).toBeNull();
  });

  it('devuelve null sin throwear cuando fetch lanza (red caída)', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'k';
    process.env.PRIVATE_LLM_SQL_MODEL = 'sqlcoder:8b';
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'x',
      question: 'y',
      demoLabel: 'bi',
    });
    expect(result).toBeNull();
  });

  it('devuelve null cuando content viene vacío del modelo', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'k';
    process.env.PRIVATE_LLM_SQL_MODEL = 'sqlcoder:8b';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });
    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'x',
      question: 'y',
      demoLabel: 'bi',
    });
    expect(result).toBeNull();
  });

  it('limpia fences ``` aunque no traiga "sql" después de los backticks', async () => {
    process.env.PRIVATE_LLM_BASE_URL = 'http://mac.local';
    process.env.PRIVATE_LLM_API_KEY = 'k';
    process.env.PRIVATE_LLM_SQL_MODEL = 'sqlcoder:8b';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```\nSELECT * FROM t\n```' } }],
      }),
    });
    const result = await svc.generateIfAvailable({
      provider: 'private-mac',
      schema: 'x',
      question: 'y',
      demoLabel: 'bi',
    });
    expect(result).toBe('SELECT * FROM t');
  });

  describe('formatHintForLlm', () => {
    it('devuelve un bloque con el SQL formateado para inyectar al prompt', () => {
      const hint = svc.formatHintForLlm('SELECT 1');
      expect(hint).toContain('# Hint del modelo SQL especializado');
      expect(hint).toContain('```sql');
      expect(hint).toContain('SELECT 1');
      expect(hint).toContain('run_sql');
      expect(hint).toContain('render_chart');
    });
  });
});
