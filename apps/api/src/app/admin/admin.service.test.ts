// -----------------------------------------------------------------------------
// Tests del AdminService.updateMyTenant.
//
// Cubre:
//   - Update parcial: solo displayName.
//   - Update con enabledDemos válidos.
//   - Validación: enabledDemos con ID inexistente → BadRequestException.
//   - Merge no destructivo de branding.
//   - NotFound si el tenant desapareció.
// -----------------------------------------------------------------------------

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantFindUnique, mockTenantUpdate } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockTenantUpdate: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    tenant: {
      findUnique: mockTenantFindUnique,
      update: mockTenantUpdate,
    },
  },
}));

import { AdminService } from './admin.service.js';
import type { DemoRegistryService } from '../demos/demo-registry.service.js';

const TENANT_ID = 'tenant-A';

const existingTenant = {
  id: TENANT_ID,
  slug: 'utpl',
  displayName: 'UTPL',
  enabledDemos: [] as string[],
  branding: { logoUrl: 'https://cdn/old.png', accentColor: '#000000' },
  status: 'active' as const,
};

const updatedTenant = (overrides: Record<string, unknown> = {}) => ({
  ...existingTenant,
  ...overrides,
  industry: { slug: 'universidad', displayName: 'Educación superior' },
});

function makeService(catalog: string[] = ['rag', 'comparator', 'tutor']) {
  const registry = {
    findAll: () => catalog.map((id) => ({ id })),
    findOne: (id: string) =>
      catalog.includes(id) ? ({ id } as unknown) : null,
  } as unknown as DemoRegistryService;
  return new AdminService(registry);
}

describe('AdminService.updateMyTenant', () => {
  beforeEach(() => {
    mockTenantFindUnique.mockReset();
    mockTenantUpdate.mockReset();
  });

  it('actualiza solo displayName cuando es el único campo', async () => {
    mockTenantFindUnique.mockResolvedValue(existingTenant);
    mockTenantUpdate.mockResolvedValue(updatedTenant({ displayName: 'Nuevo' }));

    const result = await makeService().updateMyTenant(TENANT_ID, {
      displayName: 'Nuevo',
    });

    expect(result.displayName).toBe('Nuevo');
    expect(mockTenantUpdate.mock.calls[0][0].data).toMatchObject({
      displayName: 'Nuevo',
    });
    // Sin enabledDemos ni branding en el patch → no se mandan.
    expect(mockTenantUpdate.mock.calls[0][0].data.enabledDemos).toBeUndefined();
    expect(mockTenantUpdate.mock.calls[0][0].data.branding).toBeUndefined();
  });

  it('mergea branding sin destruir campos no enviados', async () => {
    mockTenantFindUnique.mockResolvedValue(existingTenant);
    mockTenantUpdate.mockResolvedValue(
      updatedTenant({
        branding: {
          logoUrl: 'https://cdn/old.png', // ← preserved
          accentColor: '#43C194', // ← overwritten
        },
      }),
    );

    await makeService().updateMyTenant(TENANT_ID, {
      branding: { accentColor: '#43C194' },
    });

    // El merge mantiene logoUrl original y pisa accentColor.
    expect(mockTenantUpdate.mock.calls[0][0].data.branding).toEqual({
      logoUrl: 'https://cdn/old.png',
      accentColor: '#43C194',
    });
  });

  it('rechaza enabledDemos con IDs no presentes en el catálogo', async () => {
    mockTenantFindUnique.mockResolvedValue(existingTenant);

    await expect(
      makeService(['rag', 'comparator']).updateMyTenant(TENANT_ID, {
        enabledDemos: ['rag', 'fakeDemo'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockTenantUpdate).not.toHaveBeenCalled();
  });

  it('acepta enabledDemos vacío (= heredar de la industry)', async () => {
    mockTenantFindUnique.mockResolvedValue({
      ...existingTenant,
      enabledDemos: ['rag', 'tutor'],
    });
    mockTenantUpdate.mockResolvedValue(updatedTenant({ enabledDemos: [] }));

    await makeService().updateMyTenant(TENANT_ID, { enabledDemos: [] });

    expect(mockTenantUpdate.mock.calls[0][0].data.enabledDemos).toEqual([]);
  });

  it('lanza NotFoundException si el tenantId no existe', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    await expect(
      makeService().updateMyTenant('inexistente', { displayName: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });
});
