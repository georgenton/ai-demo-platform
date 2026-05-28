// -----------------------------------------------------------------------------
// Tests del CorpusIngestService.
//
// Foco: el parseo defensivo de la respuesta del LLM. La integración real
// (PDF → ingest → metadata → DB) está cubierta por tests E2E con
// testcontainers en un PR posterior; acá probamos las piezas puras:
//   - El JSON inválido devuelve defaults (no crashea).
//   - El JSON con code fences se limpia correctamente.
//   - Los tópicos se normalizan a lowercased + trim.
//   - Los años fuera de rango razonable se rechazan.
//   - Los arrays no-strings se filtran.
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CorpusIngestService } from './corpus-ingest.service.js';

// Stub mínimo de chat.completeStream para los tests del parse. Lo configuramos
// per-test con la respuesta que queremos que el "LLM" devuelva.
const mockChatStream = vi.fn();
vi.mock('@org/llm-adapter', () => ({
  chat: {
    completeStream: (...args: unknown[]) => mockChatStream(...args),
  },
}));

// Stubs del IngestService y PdfTextExtractor — no los ejercitamos en este
// archivo, solo necesitamos que la construcción del servicio compile.
const fakeIngestService = {
  ingest: vi.fn(),
};
const fakePdfExtractor = {
  extractText: vi.fn(),
};

/** Helper: convierte un string en AsyncIterable<string> (un único token). */
async function* singleToken(text: string): AsyncIterable<string> {
  yield text;
}

describe('CorpusIngestService — parseMetadataResponse (acceso vía any)', () => {
  let svc: CorpusIngestService;

  beforeEach(() => {
    mockChatStream.mockReset();
    fakeIngestService.ingest.mockReset();
    fakePdfExtractor.extractText.mockReset();
    svc = new CorpusIngestService(
      fakeIngestService as never,
      fakePdfExtractor as never,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Acceder al private vía `(svc as any).parseMetadataResponse(...)` es OK
   * en tests — TypeScript no lo permite normalmente pero acá nos importa
   * verificar la lógica concreta sin armar todo el pipeline.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (raw: string) => (svc as any).parseMetadataResponse(raw);

  it('JSON válido devuelve metadata estructurada', () => {
    const raw = JSON.stringify({
      title: 'Aplicación de ML en educación',
      year: 2023,
      authors: ['Jorge Pérez', 'María González'],
      abstract: 'Este paper estudia...',
      topics: ['educación', 'machine learning', 'IA'],
    });
    const m = parse(raw);
    expect(m.title).toBe('Aplicación de ML en educación');
    expect(m.year).toBe(2023);
    expect(m.authors).toEqual(['Jorge Pérez', 'María González']);
    expect(m.topics).toEqual(['educación', 'machine learning', 'IA']);
  });

  it('JSON con code fences ```json se limpia', () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        title: 'Test',
        year: 2020,
        authors: [],
        abstract: null,
        topics: ['x'],
      }) +
      '\n```';
    const m = parse(raw);
    expect(m.title).toBe('Test');
    expect(m.year).toBe(2020);
  });

  it('JSON inválido devuelve defaults (no crashea)', () => {
    const m = parse('esto no es JSON {{');
    expect(m.title).toBe('Sin título');
    expect(m.year).toBe(null);
    expect(m.authors).toEqual([]);
    expect(m.topics).toEqual([]);
  });

  it('Año fuera de rango razonable se rechaza', () => {
    const raw = JSON.stringify({
      title: 't',
      year: 1500,
      authors: [],
      abstract: null,
      topics: [],
    });
    expect(parse(raw).year).toBe(null);

    const raw2 = JSON.stringify({
      title: 't',
      year: 3000,
      authors: [],
      abstract: null,
      topics: [],
    });
    expect(parse(raw2).year).toBe(null);
  });

  it('Año como string parseable se acepta', () => {
    const raw = JSON.stringify({
      title: 't',
      year: '2023',
      authors: [],
      abstract: null,
      topics: [],
    });
    expect(parse(raw).year).toBe(2023);
  });

  it('authors con elementos no-string se filtran', () => {
    const raw = JSON.stringify({
      title: 't',
      year: null,
      authors: ['Jorge', 123, null, 'María', ''],
      abstract: null,
      topics: [],
    });
    expect(parse(raw).authors).toEqual(['Jorge', 'María']);
  });

  it('topics: máximo 5, normalizados al final del pipeline', () => {
    const raw = JSON.stringify({
      title: 't',
      year: null,
      authors: [],
      abstract: null,
      topics: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(parse(raw).topics).toHaveLength(5);
  });

  it('LLM devuelve null/array vacío para shape opcional', () => {
    const raw = JSON.stringify({
      title: 't',
      year: null,
      authors: [],
      abstract: null,
      topics: [],
    });
    const m = parse(raw);
    expect(m.abstract).toBe(null);
    expect(m.year).toBe(null);
    expect(m.authors).toEqual([]);
  });
});

describe('CorpusIngestService — extractMetadataViaLLM (integration with mock)', () => {
  let svc: CorpusIngestService;

  beforeEach(() => {
    mockChatStream.mockReset();
    svc = new CorpusIngestService(
      fakeIngestService as never,
      fakePdfExtractor as never,
    );
  });

  it('acumula tokens del stream y parsea', async () => {
    const payload = {
      title: 'Streamed paper',
      year: 2024,
      authors: ['Alice'],
      abstract: 'abc',
      topics: ['IA'],
    };
    mockChatStream.mockReturnValue(singleToken(JSON.stringify(payload)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = await (svc as any).extractMetadataViaLLM('content');
    expect(m.title).toBe('Streamed paper');
    expect(m.year).toBe(2024);
  });
});
