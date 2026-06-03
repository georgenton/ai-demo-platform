// -----------------------------------------------------------------------------
// Tests del cliente HTTP de auth (apps/web/src/lib/api/auth.ts).
//
// Estrategia idéntica a client.test.ts: mockeamos `fetch` global con
// vi.stubGlobal y verificamos que cada función construye la request
// correcta y maneja errores con ApiError.
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getMe, getMyDemos, login, logout } from './auth';
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

const sampleAuth = {
  user: {
    id: 'u1',
    email: 'admin@nai.local',
    displayName: 'Admin',
    role: 'superadmin' as const,
  },
  tenant: {
    id: 't1',
    slug: 'demo',
    displayName: 'Demo',
    industry: { slug: 'universidad', displayName: 'Educación' },
    branding: {},
    status: 'active' as const,
  },
};

describe('auth client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('login()', () => {
    it('hace POST a /api/v1/auth/login con credentials include', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      fetchSpy.mockResolvedValue(jsonResponse(sampleAuth));

      const result = await login({
        email: 'admin@nai.local',
        password: 's3cret',
      });

      expect(result).toEqual(sampleAuth);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBe(
        JSON.stringify({ email: 'admin@nai.local', password: 's3cret' }),
      );
    });

    it('lanza ApiError 401 con el mensaje del backend cuando las credenciales son inválidas', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        jsonResponse(
          { message: 'Credenciales inválidas', statusCode: 401 },
          { status: 401 },
        ),
      );

      await expect(
        login({ email: 'no@ne.com', password: 'wrong' }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 401,
        message: 'Credenciales inválidas',
      });
    });
  });

  describe('logout()', () => {
    it('hace POST a /api/v1/auth/logout', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));

      await logout();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    it('lanza ApiError si el server responde 500 (red interna)', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        jsonResponse(
          { message: 'Internal error', statusCode: 500 },
          { status: 500 },
        ),
      );

      await expect(logout()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('getMe()', () => {
    it('hace GET a /api/v1/auth/me y devuelve el AuthResponse', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      fetchSpy.mockResolvedValue(jsonResponse(sampleAuth));

      const result = await getMe();
      expect(result).toEqual(sampleAuth);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/me',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('lanza ApiError 401 cuando no hay sesión válida', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        jsonResponse(
          { message: 'Unauthorized', statusCode: 401 },
          { status: 401 },
        ),
      );

      await expect(getMe()).rejects.toMatchObject({
        name: 'ApiError',
        status: 401,
      });
    });
  });

  describe('getMyDemos()', () => {
    it('hace GET a /api/v1/me/demos y devuelve la cartelera', async () => {
      const meDemos = {
        tenant: {
          id: 't1',
          slug: 'demo',
          displayName: 'Demo',
          branding: {},
          status: 'active' as const,
        },
        industry: {
          slug: 'universidad',
          displayName: 'Educación',
          defaultConfig: {},
        },
        demos: [
          {
            id: 'rag',
            title: 'Chat con documentos',
            tagline: 'Tagline',
            description: 'Descripción',
            audience: ['Universidades'],
            status: 'available' as const,
            route: '/demo/rag',
          },
        ],
        overridden: false,
      };
      const fetchSpy = vi.mocked(globalThis.fetch);
      fetchSpy.mockResolvedValue(jsonResponse(meDemos));

      const result = await getMyDemos();
      expect(result).toEqual(meDemos);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/me/demos',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });
});
