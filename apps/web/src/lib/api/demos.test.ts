import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getDemo, listDemos } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('demos client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('listDemos', () => {
    it('hace GET a /api/v1/demos y devuelve el array', async () => {
      const sample = [
        {
          id: 'rag',
          title: 'Chat',
          tagline: 't',
          description: 'd',
          audience: ['x'],
          status: 'available',
          route: '/demo/rag',
        },
      ];
      vi.mocked(fetch).mockResolvedValue(jsonResponse(sample));

      const result = await listDemos();

      expect(result).toEqual(sample);
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/demos');
    });

    it('lanza ApiError con el message del backend en 5xx', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ statusCode: 500, message: 'falló DB' }, 500),
      );
      await expect(listDemos()).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
        message: 'falló DB',
      });
    });
  });

  describe('getDemo', () => {
    it('hace GET a /api/v1/demos/:id (url-encoded)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({
          id: 'rag',
          title: 't',
          tagline: 't',
          description: 'd',
          audience: ['x'],
          status: 'available',
          route: '/demo/rag',
        }),
      );

      await getDemo('rag');

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/demos/rag');
    });

    it('encodea los caracteres especiales del id', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
      await getDemo('demo/with slash');
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
        '/api/v1/demos/demo%2Fwith%20slash',
      );
    });

    it('lanza ApiError 404 cuando el demo no existe', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ statusCode: 404, message: 'Demo "xxx" no existe' }, 404),
      );
      await expect(getDemo('xxx')).rejects.toBeInstanceOf(ApiError);
    });
  });
});
