// -----------------------------------------------------------------------------
// Tests del cliente HTTP de admin (apps/web/src/lib/api/admin.ts).
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateMyTenant } from './admin';
import { ApiError } from './client';

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? '',
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleTenant = {
  id: 't1',
  slug: 'demo',
  displayName: 'Demo',
  enabledDemos: ['rag'],
  branding: { accentColor: '#43C194' },
  status: 'active' as const,
  industry: { slug: 'universidad', displayName: 'Educación' },
};

describe('admin client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('updateMyTenant()', () => {
    it('hace PATCH a /api/v1/admin/tenant con credentials include', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      fetchSpy.mockResolvedValue(jsonResponse(sampleTenant));

      const result = await updateMyTenant({
        displayName: 'UTPL',
        enabledDemos: ['rag', 'tutor'],
      });

      expect(result).toEqual(sampleTenant);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/admin/tenant',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
        }),
      );
      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBe(
        JSON.stringify({
          displayName: 'UTPL',
          enabledDemos: ['rag', 'tutor'],
        }),
      );
    });

    it('lanza ApiError 403 cuando el rol no es admin', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        jsonResponse(
          {
            message: 'Este recurso requiere rol "admin" o superior.',
            statusCode: 403,
          },
          { status: 403 },
        ),
      );

      await expect(updateMyTenant({ displayName: 'X' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 403,
      });
    });

    it('propaga ApiError 400 con detalle de validación del backend', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        jsonResponse(
          {
            message: 'enabledDemos contiene IDs inválidos: fake.',
            statusCode: 400,
          },
          { status: 400 },
        ),
      );

      await expect(
        updateMyTenant({ enabledDemos: ['fake'] }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });
});
