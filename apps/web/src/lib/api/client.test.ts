// -----------------------------------------------------------------------------
// Tests del cliente HTTP del frontend.
//
// Estrategia:
//   - Mockeamos `fetch` global con `vi.stubGlobal`. Cada test setea el
//     comportamiento que quiere (200 con payload, 400 con error de
//     validación, network error, etc.) y verifica que el cliente:
//       1) construyó la request correcta (URL, método, headers, body),
//       2) parseó la respuesta como corresponde,
//       3) lanzó `ApiError` con `status` + `message` cuando el server falla.
//
// `subscribeToChat` no se testea aquí — depende de `EventSource`, que no
// existe en el entorno node de vitest. Se ejercita indirectamente vía el
// hook `useChatStream` cuando tengamos un entorno jsdom (futuro).
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, ingestPdf, ingestText } from './client';

/**
 * Helper para armar un Response fake. Devolvemos exactamente lo que el
 * cliente necesita: `ok`, `status`, `statusText`, `json()` (que tiene que
 * funcionar con `clone()` también — el cliente llama `response.clone().json()`
 * en la rama de error).
 */
function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    statusText: init.statusText ?? '',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ingestText
  // ---------------------------------------------------------------------------

  describe('ingestText', () => {
    it('hace POST JSON a /api/v1/ingest con el body correcto', async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(
        jsonResponse({ documentId: 'doc-1', chunkCount: 3 }),
      );

      const result = await ingestText({
        name: 'manual.txt',
        content: 'hola mundo',
        demoId: 'rag',
      });

      expect(result).toEqual({ documentId: 'doc-1', chunkCount: 3 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/v1/ingest');
      expect(init?.method).toBe('POST');
      // Es una URL relativa — confiamos en que Next.js rewrites la proxea.
      expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init?.body as string)).toEqual({
        name: 'manual.txt',
        content: 'hola mundo',
        demoId: 'rag',
      });
    });

    it('lanza ApiError con el message del backend cuando responde 400', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse(
          {
            statusCode: 400,
            message: [
              'content should not be empty',
              'name should not be empty',
            ],
            error: 'Bad Request',
          },
          { status: 400 },
        ),
      );

      await expect(
        ingestText({ name: '', content: '', demoId: 'rag' }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 400,
        // El cliente concatena array de mensajes con '; ' para mostrarlos juntos.
        message: 'content should not be empty; name should not be empty',
      });
    });

    it('lanza ApiError aunque el body de error no sea JSON', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      await expect(
        ingestText({ name: 'x', content: 'x', demoId: 'rag' }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    it('propaga el AbortSignal al fetch', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ documentId: 'd', chunkCount: 0 }),
      );
      const controller = new AbortController();

      await ingestText(
        { name: 'x', content: 'x', demoId: 'rag' },
        controller.signal,
      );

      const init = vi.mocked(fetch).mock.calls[0][1];
      expect(init?.signal).toBe(controller.signal);
    });
  });

  // ---------------------------------------------------------------------------
  // ingestPdf
  // ---------------------------------------------------------------------------

  describe('ingestPdf', () => {
    it('hace POST multipart a /api/v1/ingest/file con el file y el demoId', async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(
        jsonResponse({ documentId: 'doc-2', chunkCount: 7 }),
      );

      const file = new File(['%PDF-1.4 fake'], 'reglamento.pdf', {
        type: 'application/pdf',
      });
      const result = await ingestPdf({ file, demoId: 'rag' });

      expect(result).toEqual({ documentId: 'doc-2', chunkCount: 7 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/v1/ingest/file');
      expect(init?.method).toBe('POST');

      // Crítico: NO seteamos Content-Type manualmente — fetch lo arma con el
      // boundary correcto cuando el body es FormData. Verificamos que no hay
      // headers (o que no hay Content-Type) para evitar el bug clásico.
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();

      const body = init?.body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(form.get('demoId')).toBe('rag');
      // El File se preserva tal cual (mismo nombre y tipo).
      const uploaded = form.get('file');
      expect(uploaded).toBeInstanceOf(File);
      expect((uploaded as File).name).toBe('reglamento.pdf');
      expect((uploaded as File).type).toBe('application/pdf');
    });

    it('lanza ApiError 422 cuando el backend rechaza el archivo (size/mime)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse(
          {
            statusCode: 422,
            message:
              'Validation failed (current file type is image/png, expected type is application/pdf)',
            error: 'Unprocessable Entity',
          },
          { status: 422 },
        ),
      );

      const file = new File(['fake'], 'foto.png', { type: 'image/png' });

      await expect(ingestPdf({ file, demoId: 'rag' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 422,
      });
    });
  });
});
