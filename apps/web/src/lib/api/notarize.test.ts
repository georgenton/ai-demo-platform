import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { llmProviderHeader } from '../llm/llm-provider-storage';

import {
  NOTARIZE_SAFE_PDF_MAX_BYTES,
  NOTARIZE_UPLOAD_TOO_LARGE_MESSAGE,
  uploadNotarize,
} from './notarize';

vi.mock('../llm/llm-provider-storage', () => ({
  llmProviderHeader: vi.fn(() => ({})),
}));

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}

describe('uploadNotarize', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(llmProviderHeader).mockReturnValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hace POST multipart a /api/v1/notarize sin Content-Type manual', async () => {
    vi.mocked(fetch).mockResolvedValue(
      okJson({
        documentId: 'doc-1',
        name: 'acta.pdf',
        docType: 'assembly_minutes',
        contentHash: 'abc',
        contentSize: 123,
        createdAt: '2026-07-03T00:00:00.000Z',
        analysis: null,
        anchors: [],
      }),
    );

    const file = new File(['%PDF-1.4 fake'], 'acta.pdf', {
      type: 'application/pdf',
    });

    await uploadNotarize({
      file,
      docType: 'assembly_minutes',
      mode: 'local',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/v1/notarize');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      undefined,
    );
    expect(init?.body).toBeInstanceOf(FormData);

    const form = init?.body as FormData;
    expect((form.get('file') as File).name).toBe('acta.pdf');
    expect(form.get('docType')).toBe('assembly_minutes');
    expect(form.get('mode')).toBe('local');
  });

  it('propaga X-LLM-Provider en multipart sin setear Content-Type', async () => {
    vi.mocked(llmProviderHeader).mockReturnValue({
      'X-LLM-Provider': 'private-mac',
    });
    vi.mocked(fetch).mockResolvedValue(
      okJson({
        documentId: 'doc-1',
        name: 'acta.pdf',
        docType: 'assembly_minutes',
        contentHash: 'abc',
        contentSize: 123,
        createdAt: '2026-07-03T00:00:00.000Z',
        analysis: null,
        anchors: [],
      }),
    );

    const file = new File(['%PDF-1.4 fake'], 'acta.pdf', {
      type: 'application/pdf',
    });

    await uploadNotarize({
      file,
      docType: 'assembly_minutes',
      mode: 'local',
    });

    const init = vi.mocked(fetch).mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-LLM-Provider']).toBe('private-mac');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('bloquea PDFs mayores al límite seguro antes de llamar fetch', async () => {
    const file = new File(
      [new Uint8Array(NOTARIZE_SAFE_PDF_MAX_BYTES + 1)],
      'pesado.pdf',
      { type: 'application/pdf' },
    );

    await expect(
      uploadNotarize({
        file,
        docType: 'loan',
        mode: 'local',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 413,
      message: NOTARIZE_UPLOAD_TOO_LARGE_MESSAGE,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('mapea HTTP 413 del proxy a un mensaje accionable', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Payload Too Large', {
        status: 413,
        statusText: 'Payload Too Large',
      }),
    );
    const file = new File(['%PDF-1.4 fake'], 'acta.pdf', {
      type: 'application/pdf',
    });

    await expect(
      uploadNotarize({
        file,
        docType: 'capital_contribution',
        mode: 'local',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 413,
      message: NOTARIZE_UPLOAD_TOO_LARGE_MESSAGE,
    });
  });
});
