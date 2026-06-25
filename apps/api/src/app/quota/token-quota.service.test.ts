// -----------------------------------------------------------------------------
// Tests del TokenQuotaService.
//
// Cubre:
//   - assertWithinQuota: bypass de superadmin.
//   - assertWithinQuota: passes cuando el user está debajo del límite.
//   - assertWithinQuota: lanza QuotaExceededException cuando excede.
//   - recordUsage: persiste valores correctos (incluido el provider).
//   - getUsageInWindow: suma input + output dentro de la ventana de 1h.
//
// Mockeamos prisma. No tocamos DB real.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAggregate, mockFindFirst, mockCreate } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    tokenUsage: {
      aggregate: mockAggregate,
      findFirst: mockFindFirst,
      create: mockCreate,
    },
  },
}));

import {
  DEFAULT_TOKENS_PER_HOUR_PER_USER,
  QuotaExceededException,
  TokenQuotaService,
} from './token-quota.service.js';

describe('TokenQuotaService', () => {
  beforeEach(() => {
    mockAggregate.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    delete process.env.TOKENS_PER_HOUR_PER_USER;
  });

  describe('assertWithinQuota', () => {
    it('bypass para superadmin sin consultar la DB', async () => {
      const svc = new TokenQuotaService();
      await svc.assertWithinQuota('user-1', 'superadmin');
      expect(mockAggregate).not.toHaveBeenCalled();
    });

    it('pasa cuando el user está debajo del límite', async () => {
      mockAggregate.mockResolvedValue({
        _sum: { inputTokens: 5_000, outputTokens: 3_000 }, // total 8000 < 20000
      });
      const svc = new TokenQuotaService();
      await expect(
        svc.assertWithinQuota('user-1', 'member'),
      ).resolves.toBeUndefined();
    });

    it('lanza QuotaExceededException cuando alcanza el límite', async () => {
      mockAggregate.mockResolvedValue({
        _sum: { inputTokens: 12_000, outputTokens: 9_000 }, // 21000 >= 20000
      });
      mockFindFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // hace 30 min
      });
      const svc = new TokenQuotaService();
      await expect(svc.assertWithinQuota('user-1', 'member')).rejects.toThrow(
        QuotaExceededException,
      );
    });

    it('respeta TOKENS_PER_HOUR_PER_USER del env', async () => {
      process.env.TOKENS_PER_HOUR_PER_USER = '5000';
      mockAggregate.mockResolvedValue({
        _sum: { inputTokens: 3_000, outputTokens: 3_000 }, // 6000 >= 5000
      });
      mockFindFirst.mockResolvedValue({ createdAt: new Date() });
      const svc = new TokenQuotaService();
      expect(svc.limit).toBe(5000);
      await expect(svc.assertWithinQuota('user-1', 'member')).rejects.toThrow(
        QuotaExceededException,
      );
    });

    it('cae al default si TOKENS_PER_HOUR_PER_USER es inválida', () => {
      process.env.TOKENS_PER_HOUR_PER_USER = 'asdf';
      const svc = new TokenQuotaService();
      expect(svc.limit).toBe(DEFAULT_TOKENS_PER_HOUR_PER_USER);
    });
  });

  describe('recordUsage', () => {
    it('crea la fila con los valores correctos', async () => {
      mockCreate.mockResolvedValue({});
      const svc = new TokenQuotaService();
      await svc.recordUsage({
        userId: 'user-1',
        tenantId: 'tenant-A',
        demoId: 'rag',
        inputTokens: 1500,
        outputTokens: 700,
        provider: 'anthropic',
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tenantId: 'tenant-A',
          demoId: 'rag',
          inputTokens: 1500,
          outputTokens: 700,
          provider: 'anthropic',
        },
      });
    });

    it('clampa tokens negativos a 0 (defensa contra adapters buggy)', async () => {
      mockCreate.mockResolvedValue({});
      const svc = new TokenQuotaService();
      await svc.recordUsage({
        userId: 'user-1',
        tenantId: 'tenant-A',
        inputTokens: -50,
        outputTokens: 100,
        provider: 'anthropic',
      });
      expect(mockCreate.mock.calls[0][0].data.inputTokens).toBe(0);
      expect(mockCreate.mock.calls[0][0].data.outputTokens).toBe(100);
    });
  });

  describe('getUsageInWindow', () => {
    it('suma input + output de la última hora', async () => {
      mockAggregate.mockResolvedValue({
        _sum: { inputTokens: 800, outputTokens: 200 },
      });
      const svc = new TokenQuotaService();
      const total = await svc.getUsageInWindow('user-1');
      expect(total).toBe(1000);
    });

    it('devuelve 0 cuando no hay registros', async () => {
      mockAggregate.mockResolvedValue({
        _sum: { inputTokens: null, outputTokens: null },
      });
      const svc = new TokenQuotaService();
      const total = await svc.getUsageInWindow('user-1');
      expect(total).toBe(0);
    });
  });
});
