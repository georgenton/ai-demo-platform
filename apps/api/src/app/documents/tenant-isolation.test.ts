// -----------------------------------------------------------------------------
// Test de aislamiento multi-tenant — DocumentsService.
//
// Verifica el invariante crítico de ADR-0013: ningún path del DocumentsService
// puede devolver, leer o borrar un Document que no pertenezca al tenantId
// pasado por el caller (idealmente desde el JWT vía TenantGuard).
//
// El test no toca la DB real — mockea Prisma con dos "tablas virtuales", una
// por tenant, y verifica que las queries siempre incluyen el filtro tenantId
// en el where. Si alguien olvida agregar el filtro en una query nueva, este
// test debería romperse.
//
// Por qué importa: en multi-tenant soft (una sola DB) el aislamiento es
// puramente disciplina del código. Un olvido = data leak entre clientes. Este
// archivo es la primera línea de defensa.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindMany,
  mockFindFirst,
  mockCount,
  mockDelete,
  mockChunkFindMany,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCount: vi.fn(),
  mockDelete: vi.fn(),
  mockChunkFindMany: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      count: mockCount,
      delete: mockDelete,
    },
    chunk: {
      findMany: mockChunkFindMany,
    },
  },
}));

import { DocumentsService } from './documents.service.js';

// "DB virtual" — solo dos documentos, uno por tenant.
const DOC_A = {
  id: 'doc-A',
  name: 'reglamento-tenant-A.pdf',
  content: 'contenido confidencial del tenant A',
  demoId: 'rag',
  tenantId: 'tenant-A',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  _count: { chunks: 1 },
};

const DOC_B = {
  id: 'doc-B',
  name: 'reglamento-tenant-B.pdf',
  content: 'contenido confidencial del tenant B',
  demoId: 'rag',
  tenantId: 'tenant-B',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  _count: { chunks: 1 },
};

const VIRTUAL_DB = [DOC_A, DOC_B];

/**
 * Reemplaza al motor de Prisma: filtra el array por la condición del where.
 * Solo entiende los campos que usa el service real (`id`, `tenantId`,
 * `demoId`) — alcanza para verificar el aislamiento.
 */
function filterByWhere(where: Record<string, unknown>) {
  return VIRTUAL_DB.filter((doc) => {
    if (where.id !== undefined && doc.id !== where.id) return false;
    if (where.tenantId !== undefined && doc.tenantId !== where.tenantId)
      return false;
    if (where.demoId !== undefined && doc.demoId !== where.demoId) return false;
    return true;
  });
}

describe('DocumentsService — aislamiento multi-tenant', () => {
  let service: DocumentsService;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCount.mockReset();
    mockDelete.mockReset();
    mockChunkFindMany.mockReset();

    // Wire de la "DB virtual": cada método respeta el where que recibe.
    mockFindMany.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        return filterByWhere(args.where);
      },
    );
    mockFindFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        const matches = filterByWhere(args.where);
        return matches[0] ?? null;
      },
    );
    mockCount.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        return filterByWhere(args.where).length;
      },
    );
    mockDelete.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        const found = filterByWhere(args.where)[0];
        if (!found) throw new Error('mock delete: not found');
        return found;
      },
    );
    mockChunkFindMany.mockResolvedValue([
      { id: 'c1', index: 0, content: 'chunk' },
    ]);

    service = new DocumentsService();
  });

  describe('findAll', () => {
    it('tenant A solo ve sus propios documentos', async () => {
      const result = await service.findAll({}, 'tenant-A');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('doc-A');
      expect(result.total).toBe(1);
    });

    it('tenant B solo ve sus propios documentos', async () => {
      const result = await service.findAll({}, 'tenant-B');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('doc-B');
    });

    it('tenant inexistente devuelve lista vacía (no leak)', async () => {
      const result = await service.findAll({}, 'tenant-X');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('tenant A puede leer su propio documento', async () => {
      const result = await service.findOne('doc-A', 'tenant-A');
      expect(result.id).toBe('doc-A');
      expect(result.content).toBe('contenido confidencial del tenant A');
    });

    it('tenant A NO puede leer documento del tenant B (404, no 403)', async () => {
      // 404 en lugar de 403 a propósito — no queremos confirmar la existencia
      // del recurso en otro tenant. Sería un leak de información.
      await expect(service.findOne('doc-B', 'tenant-A')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenant B NO puede leer documento del tenant A', async () => {
      await expect(service.findOne('doc-A', 'tenant-B')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findChunks', () => {
    it('tenant A puede listar chunks de su documento', async () => {
      const result = await service.findChunks('doc-A', 'tenant-A');
      expect(result).toHaveLength(1);
    });

    it('tenant A NO puede listar chunks de documento del tenant B', async () => {
      await expect(service.findChunks('doc-B', 'tenant-A')).rejects.toThrow(
        NotFoundException,
      );
      // Importante: ni siquiera intentamos pegarle a la tabla chunks.
      expect(mockChunkFindMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('tenant A puede borrar su propio documento', async () => {
      await service.remove('doc-A', 'tenant-A');
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'doc-A' } });
    });

    it('tenant A NO puede borrar documento del tenant B (404, sin delete)', async () => {
      await expect(service.remove('doc-B', 'tenant-A')).rejects.toThrow(
        NotFoundException,
      );
      // Crítico: NUNCA debe llegar al delete si el tenant no calza.
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
