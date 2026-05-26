// -----------------------------------------------------------------------------
// Tests del DocumentsService.
//
// Service puro de lectura/borrado — mock de prisma con vi.mock. Cubrimos:
//   - findAll: defaults, filtro por demoId, paginación, mapeo de _count.chunks
//   - findOne: hit y 404
//   - findChunks: hit, sin embeddings en la salida, 404 si el doc no existe
//   - remove: borra y 404 si el doc no existe
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindMany,
  mockFindUnique,
  mockCount,
  mockDelete,
  mockChunkFindMany,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCount: vi.fn(),
  mockDelete: vi.fn(),
  mockChunkFindMany: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
      delete: mockDelete,
    },
    chunk: {
      findMany: mockChunkFindMany,
    },
  },
}));

import { DocumentsService } from './documents.service.js';

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockCount.mockReset();
    mockDelete.mockReset();
    mockChunkFindMany.mockReset();
    service = new DocumentsService();
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('aplica defaults (limit=20, offset=0, sin filtro) y mapea _count.chunks', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'd1',
          name: 'a.pdf',
          demoId: 'rag',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
          _count: { chunks: 3 },
        },
      ]);
      mockCount.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [
          {
            id: 'd1',
            name: 'a.pdf',
            demoId: 'rag',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            chunkCount: 3,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });

      // Sin filtro, donde queda {}.
      expect(mockFindMany.mock.calls[0][0]).toMatchObject({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filtra por demoId y respeta limit/offset cuando se proveen', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(42);

      const result = await service.findAll({
        demoId: 'rag',
        limit: 5,
        offset: 10,
      });

      expect(result).toEqual({
        items: [],
        total: 42,
        limit: 5,
        offset: 10,
      });

      expect(mockFindMany.mock.calls[0][0]).toMatchObject({
        where: { demoId: 'rag' },
        skip: 10,
        take: 5,
      });
      expect(mockCount).toHaveBeenCalledWith({ where: { demoId: 'rag' } });
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('devuelve el documento con content completo y chunkCount', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'd1',
        name: 'doc.pdf',
        content: 'texto completo extraído',
        demoId: 'rag',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        _count: { chunks: 5 },
      });

      const result = await service.findOne('d1');

      expect(result).toEqual({
        id: 'd1',
        name: 'doc.pdf',
        content: 'texto completo extraído',
        demoId: 'rag',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        chunkCount: 5,
      });
    });

    it('lanza 404 con el id en el mensaje cuando no existe', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.findOne('xxx')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('xxx')).rejects.toThrow(/xxx/);
    });
  });

  // -------------------------------------------------------------------------
  // findChunks
  // -------------------------------------------------------------------------

  describe('findChunks()', () => {
    it('devuelve los chunks ordenados por index, sin embeddings', async () => {
      mockFindUnique.mockResolvedValue({ id: 'd1' });
      mockChunkFindMany.mockResolvedValue([
        { id: 'c1', index: 0, content: 'primer chunk' },
        { id: 'c2', index: 1, content: 'segundo chunk' },
      ]);

      const result = await service.findChunks('d1');

      expect(result).toEqual([
        { id: 'c1', index: 0, content: 'primer chunk' },
        { id: 'c2', index: 1, content: 'segundo chunk' },
      ]);

      // El select del findMany NO incluye `embedding` — verificación explícita.
      expect(mockChunkFindMany.mock.calls[0][0]).toMatchObject({
        where: { documentId: 'd1' },
        orderBy: { index: 'asc' },
        select: { id: true, index: true, content: true },
      });
      expect(
        mockChunkFindMany.mock.calls[0][0].select.embedding,
      ).toBeUndefined();
    });

    it('lanza 404 si el documento padre no existe (no devuelve [] silencioso)', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.findChunks('xxx')).rejects.toThrow(
        NotFoundException,
      );
      // Nunca llamó al findMany de chunks.
      expect(mockChunkFindMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('verifica que existe y borra (cascade lo manejará Postgres)', async () => {
      mockFindUnique.mockResolvedValue({ id: 'd1' });
      mockDelete.mockResolvedValue({ id: 'd1' });

      await service.remove('d1');

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });

    it('lanza 404 sin tocar delete cuando el id no existe', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.remove('xxx')).rejects.toThrow(NotFoundException);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
