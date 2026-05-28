// -----------------------------------------------------------------------------
// Tests unitarios del CorpusStatsService.
//
// Mockeamos `prisma` en lugar de levantar un container Postgres — los
// integration tests del flujo completo (ingest + stats + search + summary)
// los hacemos contra la DB real en el PR de dataset/smoke.
//
// Foco:
//   - papersByYear filtra correctamente year=null (no entran al bar chart)
//   - topTopics convierte bigint → number sin perder datos
//   - papers() arma la paginación y mapea topics como array de strings
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockGroupBy = vi.fn();
const mockFindMany = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      count: (...args: unknown[]) => mockCount(...args),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// El import debe ir DESPUÉS de los mocks para que vi.mock aplique.
import { CorpusStatsService } from './corpus-stats.service.js';

describe('CorpusStatsService', () => {
  let svc: CorpusStatsService;

  beforeEach(() => {
    mockCount.mockReset();
    mockGroupBy.mockReset();
    mockFindMany.mockReset();
    mockQueryRaw.mockReset();
    svc = new CorpusStatsService();
  });

  describe('stats()', () => {
    it('combina total + papersByYear + topTopics en paralelo', async () => {
      mockCount.mockResolvedValue(42);
      mockGroupBy.mockResolvedValue([
        { year: 2020, _count: { _all: 3 } },
        { year: 2021, _count: { _all: 5 } },
      ]);
      mockQueryRaw.mockResolvedValue([
        { topic: 'educación', count: 12n },
        { topic: 'salud', count: 8n },
      ]);

      const result = await svc.stats();

      expect(result.totalPapers).toBe(42);
      expect(result.papersByYear).toEqual([
        { year: 2020, count: 3 },
        { year: 2021, count: 5 },
      ]);
      expect(result.topTopics).toEqual([
        { topic: 'educación', count: 12 },
        { topic: 'salud', count: 8 },
      ]);
    });

    it('papersByYear filtra rows con year=null', async () => {
      mockCount.mockResolvedValue(10);
      // Prisma puede devolver `null` aunque WHERE filtre — defensivo.
      mockGroupBy.mockResolvedValue([
        { year: 2020, _count: { _all: 3 } },
        { year: null, _count: { _all: 7 } },
      ]);
      mockQueryRaw.mockResolvedValue([]);

      const result = await svc.stats();

      expect(result.papersByYear).toEqual([{ year: 2020, count: 3 }]);
    });

    it('topTopics convierte bigint a number', async () => {
      mockCount.mockResolvedValue(1);
      mockGroupBy.mockResolvedValue([]);
      // Postgres COUNT(*) llega como bigint via Prisma raw.
      mockQueryRaw.mockResolvedValue([{ topic: 'x', count: 999999n }]);

      const result = await svc.stats();

      expect(result.topTopics[0].count).toBe(999999);
      expect(typeof result.topTopics[0].count).toBe('number');
    });

    it('corpus vacío devuelve estructuras vacías sin crashear', async () => {
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);
      mockQueryRaw.mockResolvedValue([]);

      const result = await svc.stats();

      expect(result.totalPapers).toBe(0);
      expect(result.papersByYear).toEqual([]);
      expect(result.topTopics).toEqual([]);
    });
  });

  describe('papers()', () => {
    it('mapea documents+topics a items planos con array de strings', async () => {
      mockCount.mockResolvedValue(2);
      mockFindMany.mockResolvedValue([
        {
          id: 'd1',
          name: 'paper-1.pdf',
          year: 2023,
          authors: ['Jorge'],
          createdAt: new Date('2026-05-28T12:00:00Z'),
          topics: [{ topic: 'educación' }, { topic: 'IA' }],
        },
        {
          id: 'd2',
          name: 'paper-2.pdf',
          year: null,
          authors: [],
          createdAt: new Date('2026-05-27T10:00:00Z'),
          topics: [],
        },
      ]);

      const result = await svc.papers({ limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: 'd1',
        name: 'paper-1.pdf',
        year: 2023,
        authors: ['Jorge'],
        topics: ['educación', 'IA'],
        createdAt: '2026-05-28T12:00:00.000Z',
      });
      expect(result.items[1].topics).toEqual([]);
      expect(result.items[1].year).toBe(null);
    });

    it('defaults limit=20, offset=0 cuando no se pasan', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      const result = await svc.papers({});

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('respeta limit y offset del caller', async () => {
      mockCount.mockResolvedValue(100);
      mockFindMany.mockResolvedValue([]);

      const result = await svc.papers({ limit: 5, offset: 40 });

      expect(result.limit).toBe(5);
      expect(result.offset).toBe(40);
      // El mock de findMany debió recibir skip=40, take=5.
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 5 }),
      );
    });
  });
});
