// -----------------------------------------------------------------------------
// Tests del cliente HTTP de corpus (no-SSE: upload + stats + papers).
//
// Los métodos SSE (subscribeToCorpusSearch, subscribeToCorpusSummary) usan
// EventSource — sin test porque jsdom no lo trae (mismo trade-off que
// subscribeToChat, documentado en client.test.ts:12).
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './client';
import {
  fetchCorpusPapers,
  fetchCorpusStats,
  uploadCorpusBatch,
} from './corpus';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helper: respuesta JSON OK con body arbitrario.
function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('uploadCorpusBatch', () => {
  it('hace POST multipart a /api/v1/corpus/upload con campo "files"', async () => {
    const file1 = new File(['contents1'], 'paper1.pdf', {
      type: 'application/pdf',
    });
    const file2 = new File(['contents2'], 'paper2.pdf', {
      type: 'application/pdf',
    });

    mockFetch.mockResolvedValue(
      okJson({ items: [], successCount: 0, failureCount: 0 }),
    );

    await uploadCorpusBatch([file1, file2]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/corpus/upload');
    expect((init as RequestInit).method).toBe('POST');

    // El body debe ser FormData con dos entradas "files".
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const files = body.getAll('files') as File[];
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('paper1.pdf');
    expect(files[1].name).toBe('paper2.pdf');
  });

  it('NO setea Content-Type manual (fetch agrega multipart boundary solo)', async () => {
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    mockFetch.mockResolvedValue(
      okJson({ items: [], successCount: 0, failureCount: 0 }),
    );

    await uploadCorpusBatch([file]);

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string> | undefined;
    if (headers) {
      // Si pusieran un Content-Type manual, el upload se rompería.
      expect(headers['Content-Type']).toBeUndefined();
      expect(headers['content-type']).toBeUndefined();
    }
  });

  it('rechaza con ApiError si la lista está vacía (no hace fetch)', async () => {
    await expect(uploadCorpusBatch([])).rejects.toThrow(ApiError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lanza ApiError con el mensaje del backend en 422', async () => {
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Archivo demasiado grande',
          error: 'Unprocessable Entity',
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(uploadCorpusBatch([file])).rejects.toThrow(ApiError);
  });
});

describe('fetchCorpusStats', () => {
  it('hace GET a /api/v1/corpus/stats y devuelve el shape', async () => {
    const expected = {
      totalPapers: 5,
      papersByYear: [{ year: 2024, count: 5 }],
      topTopics: [{ topic: 'educación', count: 3 }],
    };
    mockFetch.mockResolvedValue(okJson(expected));

    const result = await fetchCorpusStats();

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/corpus/stats', {
      signal: undefined,
    });
    expect(result).toEqual(expected);
  });

  it('propaga AbortSignal al fetch', async () => {
    const ctrl = new AbortController();
    mockFetch.mockResolvedValue(
      okJson({ totalPapers: 0, papersByYear: [], topTopics: [] }),
    );

    await fetchCorpusStats(ctrl.signal);

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ctrl.signal);
  });

  it('lanza ApiError con status del backend cuando falla', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'boom' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(fetchCorpusStats()).rejects.toThrow(ApiError);
  });
});

describe('fetchCorpusPapers', () => {
  it('por default no agrega query string', async () => {
    mockFetch.mockResolvedValue(
      okJson({ items: [], total: 0, limit: 20, offset: 0 }),
    );

    await fetchCorpusPapers();

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/corpus/papers', {
      signal: undefined,
    });
  });

  it('agrega limit y offset al query string cuando se pasan', async () => {
    mockFetch.mockResolvedValue(
      okJson({ items: [], total: 0, limit: 5, offset: 10 }),
    );

    await fetchCorpusPapers({ limit: 5, offset: 10 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });

  it('devuelve la lista paginada parseada', async () => {
    const expected = {
      items: [
        {
          id: 'd1',
          name: 'p1.pdf',
          year: 2023,
          authors: ['Jorge'],
          topics: ['IA'],
          createdAt: '2026-05-28T12:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    };
    mockFetch.mockResolvedValue(okJson(expected));

    const result = await fetchCorpusPapers();

    expect(result).toEqual(expected);
  });
});
