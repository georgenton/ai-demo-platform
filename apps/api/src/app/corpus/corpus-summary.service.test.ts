// -----------------------------------------------------------------------------
// Tests del CorpusSummaryService — el map-reduce LLM.
//
// Mockeamos `chat.completeStream` y `prisma.document.findMany`. Foco:
//   - Corpus chico (< 3 papers) devuelve mensaje fijo sin llamar al LLM
//   - Map+reduce funciona: N llamadas al LLM en map + 1 en reduce
//   - Si un paper falla durante el map, no aborta el resto
//   - El reduce recibe stats correctamente
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockChatStream = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@org/llm-adapter', () => ({
  chat: {
    completeStream: (...args: unknown[]) => mockChatStream(...args),
  },
}));

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { CorpusSummaryService } from './corpus-summary.service.js';

/** Stats service fake — los tests solo necesitan el método `stats`. */
const fakeStatsService = {
  stats: vi.fn(),
} as never;

/** Helper: convierte un string en AsyncIterable<string> (un único token). */
async function* singleToken(text: string): AsyncIterable<string> {
  yield text;
}

/** Helper: consume el async iterable del summary y devuelve el texto completo. */
async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const t of stream) out += t;
  return out;
}

describe('CorpusSummaryService.streamSummary', () => {
  let svc: CorpusSummaryService;

  beforeEach(() => {
    mockChatStream.mockReset();
    mockFindMany.mockReset();
    vi.mocked(fakeStatsService.stats).mockReset();
    svc = new CorpusSummaryService(fakeStatsService);
  });

  it('corpus con menos de 3 papers devuelve mensaje fijo (no llama al LLM)', async () => {
    vi.mocked(fakeStatsService.stats).mockResolvedValue({
      totalPapers: 1,
      papersByYear: [],
      topTopics: [],
    });

    const out = await collect(svc.streamSummary());

    expect(out).toContain('solo 1 paper');
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it('corpus de 3+ papers ejecuta map (N llamadas) + reduce (1 llamada)', async () => {
    vi.mocked(fakeStatsService.stats).mockResolvedValue({
      totalPapers: 3,
      papersByYear: [{ year: 2023, count: 3 }],
      topTopics: [{ topic: 'educación', count: 2 }],
    });
    mockFindMany.mockResolvedValue([
      { name: 'p1.pdf', year: 2023, authors: ['A'], abstract: 'abc' },
      { name: 'p2.pdf', year: 2023, authors: ['B'], abstract: 'def' },
      { name: 'p3.pdf', year: 2023, authors: ['C'], abstract: 'ghi' },
    ]);

    // El mock devuelve "Resumen N" en cada llamada — 3 mapas + 1 reduce.
    let callCount = 0;
    mockChatStream.mockImplementation(() => {
      callCount++;
      return singleToken(`Resumen ${callCount}`);
    });

    const out = await collect(svc.streamSummary());

    // 3 map + 1 reduce = 4 llamadas al LLM.
    expect(mockChatStream).toHaveBeenCalledTimes(4);
    // El último token emitido es el resultado del reduce.
    expect(out).toContain('Resumen 4');
  });

  it('si un map paper falla, el resto sigue (no aborta)', async () => {
    vi.mocked(fakeStatsService.stats).mockResolvedValue({
      totalPapers: 3,
      papersByYear: [],
      topTopics: [],
    });
    mockFindMany.mockResolvedValue([
      { name: 'p1.pdf', year: null, authors: [], abstract: 'a' },
      { name: 'p2.pdf', year: null, authors: [], abstract: 'b' },
      { name: 'p3.pdf', year: null, authors: [], abstract: 'c' },
    ]);

    // El segundo paper falla; los otros y el reduce siguen.
    let callCount = 0;
    mockChatStream.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // El generator tira antes de yieldear — simula error de provider
        // mid-stream. La regla require-yield espera al menos un yield, pero
        // acá es intencional: estamos testeando el path de error.
        return (async function* () {
          throw new Error('rate limit');

          yield '';
        })();
      }
      return singleToken(`ok-${callCount}`);
    });

    const out = await collect(svc.streamSummary());

    // 3 map (1 falla) + 1 reduce = 4 invocaciones.
    expect(mockChatStream).toHaveBeenCalledTimes(4);
    // El reduce arrancó (devolvió "ok-4" como su token).
    expect(out).toContain('ok-4');
  });
});
