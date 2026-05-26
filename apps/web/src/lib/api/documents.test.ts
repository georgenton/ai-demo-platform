import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  deleteDocument,
  getDocument,
  listDocumentChunks,
  listDocuments,
} from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('documents client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // listDocuments
  // -------------------------------------------------------------------------

  describe('listDocuments', () => {
    it('hace GET sin query string cuando no hay filtros', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }),
      );

      await listDocuments();

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/documents');
    });

    it('serializa demoId/limit/offset al query string', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ items: [], total: 0, limit: 5, offset: 10 }),
      );

      await listDocuments({ demoId: 'rag', limit: 5, offset: 10 });

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('demoId=rag');
      expect(url).toContain('limit=5');
      expect(url).toContain('offset=10');
    });
  });

  // -------------------------------------------------------------------------
  // getDocument
  // -------------------------------------------------------------------------

  describe('getDocument', () => {
    it('hace GET a /:id', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({
          id: 'd1',
          name: 'a.pdf',
          content: 'x',
          demoId: 'rag',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          chunkCount: 3,
        }),
      );

      const result = await getDocument('d1');

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/documents/d1');
      expect(result.chunkCount).toBe(3);
    });

    it('404 con id desconocido', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ statusCode: 404, message: 'no existe' }, 404),
      );
      await expect(getDocument('xxx')).rejects.toBeInstanceOf(ApiError);
    });
  });

  // -------------------------------------------------------------------------
  // listDocumentChunks
  // -------------------------------------------------------------------------

  describe('listDocumentChunks', () => {
    it('hace GET a /:id/chunks', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse([{ id: 'c1', index: 0, content: 'frag' }]),
      );

      const chunks = await listDocumentChunks('d1');

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
        '/api/v1/documents/d1/chunks',
      );
      expect(chunks).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // deleteDocument
  // -------------------------------------------------------------------------

  describe('deleteDocument', () => {
    it('hace DELETE a /:id y no parsea body (204)', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

      await deleteDocument('d1');

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('/api/v1/documents/d1');
      expect(init?.method).toBe('DELETE');
    });

    it('lanza ApiError 404 si el doc no existe', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ statusCode: 404, message: 'no existe' }, 404),
      );
      await expect(deleteDocument('xxx')).rejects.toBeInstanceOf(ApiError);
    });
  });
});
