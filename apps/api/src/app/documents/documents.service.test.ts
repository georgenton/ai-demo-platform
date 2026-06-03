// -----------------------------------------------------------------------------
// Tests del DocumentsService.
//
// Service puro de lectura/borrado — mock de prisma con vi.mock. Cubrimos:
//   - findAll: defaults, filtro por demoId, paginación, mapeo de _count.chunks
//   - findOne: hit y 404
//   - findChunks: hit, sin embeddings en la salida, 404 si el doc no existe
//   - remove: borra y 404 si el doc no existe
//
// Multi-tenant (ADR-0013): todas las llamadas pasan tenantId. Después de
// PR-MT2, `findOne`/`findChunks`/`remove` usan `findFirst({ where: { id,
// tenantId } })` para que un usuario del tenant A no pueda leer/borrar un
// documento del tenant B. Los tests reflejan esa firma.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindMany,
  mockFindFirst,
  mockFindUnique,
  mockCount,
  mockDelete,
  mockChunkFindMany,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCount: vi.fn(),
  mockDelete: vi.fn(),
  mockChunkFindMany: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
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

const TENANT_ID = 'tenant-test';

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
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
    it('aplica defaults (limit=20, offset=0, sin filtro de demoId) y mapea _count.chunks', async () => {
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

      const result = await service.findAll({}, TENANT_ID);

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

      // Sin demoId, where solo trae tenantId.
      expect(mockFindMany.mock.calls[0][0]).toMatchObject({
        where: { tenantId: TENANT_ID },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filtra por demoId y respeta limit/offset cuando se proveen', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(42);

      const result = await service.findAll(
        {
          demoId: 'rag',
          limit: 5,
          offset: 10,
        },
        TENANT_ID,
      );

      expect(result).toEqual({
        items: [],
        total: 42,
        limit: 5,
        offset: 10,
      });

      expect(mockFindMany.mock.calls[0][0]).toMatchObject({
        where: { tenantId: TENANT_ID, demoId: 'rag' },
        skip: 10,
        take: 5,
      });
      expect(mockCount).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, demoId: 'rag' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('devuelve el documento con content completo y chunkCount', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        name: 'doc.pdf',
        content: 'texto completo extraído',
        demoId: 'rag',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        _count: { chunks: 5 },
      });

      const result = await service.findOne('d1', TENANT_ID);

      expect(result).toEqual({
        id: 'd1',
        name: 'doc.pdf',
        content: 'texto completo extraído',
        demoId: 'rag',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        chunkCount: 5,
      });

      // El where filtra por tenantId — un doc de otro tenant da 404.
      expect(mockFindFirst.mock.calls[0][0]).toMatchObject({
        where: { id: 'd1', tenantId: TENANT_ID },
      });
    });

    it('lanza 404 con el id en el mensaje cuando no existe', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(service.findOne('xxx', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('xxx', TENANT_ID)).rejects.toThrow(/xxx/);
    });

    it('lanza 404 cuando el doc existe pero pertenece a otro tenant', async () => {
      // findFirst con WHERE tenantId no encuentra el doc del otro tenant —
      // simulamos eso devolviendo null. El mensaje de error es el mismo que
      // "no existe" → no se filtra existencia entre tenants.
      mockFindFirst.mockResolvedValue(null);
      await expect(service.findOne('d1', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // findChunks
  // -------------------------------------------------------------------------

  describe('findChunks()', () => {
    it('devuelve los chunks ordenados por index, sin embeddings', async () => {
      mockFindFirst.mockResolvedValue({ id: 'd1' });
      mockChunkFindMany.mockResolvedValue([
        { id: 'c1', index: 0, content: 'primer chunk' },
        { id: 'c2', index: 1, content: 'segundo chunk' },
      ]);

      const result = await service.findChunks('d1', TENANT_ID);

      expect(result).toEqual([
        { id: 'c1', index: 0, content: 'primer chunk' },
        { id: 'c2', index: 1, content: 'segundo chunk' },
      ]);

      // La verificación de existencia filtra por tenant.
      expect(mockFindFirst.mock.calls[0][0]).toMatchObject({
        where: { id: 'd1', tenantId: TENANT_ID },
      });

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
      mockFindFirst.mockResolvedValue(null);
      await expect(service.findChunks('xxx', TENANT_ID)).rejects.toThrow(
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
    it('verifica que existe (por tenant) y borra (cascade lo maneja Postgres)', async () => {
      mockFindFirst.mockResolvedValue({ id: 'd1' });
      mockDelete.mockResolvedValue({ id: 'd1' });

      await service.remove('d1', TENANT_ID);

      expect(mockFindFirst.mock.calls[0][0]).toMatchObject({
        where: { id: 'd1', tenantId: TENANT_ID },
      });
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });

    it('lanza 404 sin tocar delete cuando el id no existe', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(service.remove('xxx', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
