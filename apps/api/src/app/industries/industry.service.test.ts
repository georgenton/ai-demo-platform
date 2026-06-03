// -----------------------------------------------------------------------------
// Tests del IndustryService.
//
// Cubre la regla central de ADR-0013:
//   - tenant.enabledDemos vacío → hereda industry.enabledDemos
//   - tenant.enabledDemos con valores → pisa industry.enabledDemos
//
// Mock de prisma con vi.mock — no toca DB.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantFindUnique } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    tenant: {
      findUnique: mockTenantFindUnique,
    },
  },
}));

import { IndustryService } from './industry.service.js';

const baseTenant = {
  id: 'tenant-A',
  slug: 'utpl',
  displayName: 'UTPL',
  branding: { accentColor: '#0A66C2' },
  status: 'active' as const,
  industryId: 'ind-1',
  enabledDemos: [] as string[],
  createdAt: new Date(),
};

const baseIndustry = {
  id: 'ind-1',
  slug: 'universidad',
  displayName: 'Educación superior',
  enabledDemos: ['rag', 'comparator', 'corpus'] as string[],
  defaultConfig: { welcomeCopy: 'Demo univ' },
  createdAt: new Date(),
};

describe('IndustryService', () => {
  let service: IndustryService;

  beforeEach(() => {
    mockTenantFindUnique.mockReset();
    service = new IndustryService();
  });

  describe('resolveEnabledDemos — regla de herencia', () => {
    it('hereda enabledDemos de la industry cuando tenant.enabledDemos = []', async () => {
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: [],
        industry: baseIndustry,
      });

      const result = await service.resolveEnabledDemos('tenant-A');

      expect(result.enabledDemos).toEqual(['rag', 'comparator', 'corpus']);
      expect(result.overridden).toBe(false);
      expect(result.tenant.id).toBe('tenant-A');
      expect(result.industry.slug).toBe('universidad');
    });

    it('usa el override del tenant cuando tenant.enabledDemos tiene valores', async () => {
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: ['rag'], // override: solo rag, ni comparator ni corpus
        industry: baseIndustry,
      });

      const result = await service.resolveEnabledDemos('tenant-A');

      expect(result.enabledDemos).toEqual(['rag']);
      expect(result.overridden).toBe(true);
    });

    it('override puede incluir demos que NO están en la default de industry', async () => {
      // Caso real: el tenant compró el demo Tutor aunque la industry
      // universidad por default no lo trae.
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: ['rag', 'tutor'],
        industry: { ...baseIndustry, enabledDemos: ['rag', 'comparator'] },
      });

      const result = await service.resolveEnabledDemos('tenant-A');

      expect(result.enabledDemos).toEqual(['rag', 'tutor']);
      expect(result.overridden).toBe(true);
    });

    it('lanza NotFoundException si el tenantId no existe', async () => {
      mockTenantFindUnique.mockResolvedValue(null);
      await expect(service.resolveEnabledDemos('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hasDemo — checkeo binario', () => {
    it('devuelve true cuando el demo está en la lista resuelta', async () => {
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: [],
        industry: baseIndustry,
      });
      expect(await service.hasDemo('tenant-A', 'rag')).toBe(true);
    });

    it('devuelve false cuando el demo NO está en la lista resuelta', async () => {
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: [],
        industry: baseIndustry,
      });
      expect(await service.hasDemo('tenant-A', 'tutor')).toBe(false);
    });

    it('respeta el override del tenant', async () => {
      // Industry permite [rag, comparator, corpus]; tenant override = []
      // (no hay valores), heredaría todo. Pero si el tenant overridea con
      // solo ['rag'], comparator deja de estar habilitado.
      mockTenantFindUnique.mockResolvedValue({
        ...baseTenant,
        enabledDemos: ['rag'],
        industry: baseIndustry,
      });
      expect(await service.hasDemo('tenant-A', 'rag')).toBe(true);
      expect(await service.hasDemo('tenant-A', 'comparator')).toBe(false);
    });
  });
});
