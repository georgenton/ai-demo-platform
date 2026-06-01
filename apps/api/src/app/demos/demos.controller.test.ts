// -----------------------------------------------------------------------------
// Tests del DemosController.
//
// Comportamiento HTTP del controller:
//   - list() filtra el catálogo del registry por los enabledDemos del tenant.
//   - detail() devuelve 200 si el demo existe Y está habilitado para el tenant.
//   - detail() lanza 404 cuando NO existe O cuando existe pero no habilitado.
//
// El registry y el IndustryService se pasan stubbeados — el SUT (system under
// test) es solo el controller. La regla de herencia se cubre en
// industry.service.test.ts.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DemosController } from './demos.controller.js';
import type { DemoRegistryService } from './demo-registry.service.js';
import type { DemoMetadata } from './demo-registry.types.js';
import type { IndustryService } from '../industries/industry.service.js';

const sampleDemo: DemoMetadata = {
  id: 'rag',
  title: 'Sample',
  tagline: 'Tagline',
  description: 'Description',
  audience: ['Universidades'],
  status: 'available',
  route: '/demo/rag',
};

const otherDemo: DemoMetadata = {
  id: 'tutor',
  title: 'Tutor',
  tagline: 'Tagline',
  description: 'Description',
  audience: ['Idiomas'],
  status: 'available',
  route: '/demo/tutor',
};

const TENANT_ID = 'tenant-A';

describe('DemosController', () => {
  function makeController(stubs: {
    findAll?: ReturnType<typeof vi.fn>;
    findOne?: ReturnType<typeof vi.fn>;
    resolveEnabledDemos?: ReturnType<typeof vi.fn>;
    hasDemo?: ReturnType<typeof vi.fn>;
  }) {
    const registry = {
      findAll: stubs.findAll ?? vi.fn(() => []),
      findOne: stubs.findOne ?? vi.fn(),
    } as unknown as DemoRegistryService;
    const industryService = {
      resolveEnabledDemos:
        stubs.resolveEnabledDemos ??
        vi.fn(async () => ({
          tenant: {
            id: TENANT_ID,
            slug: 'a',
            displayName: 'A',
            branding: {},
            status: 'active' as const,
          },
          industry: {
            slug: 'universidad',
            displayName: 'Educación',
            defaultConfig: {},
          },
          enabledDemos: ['rag'],
          overridden: false,
        })),
      hasDemo: stubs.hasDemo ?? vi.fn(),
    } as unknown as IndustryService;
    return {
      controller: new DemosController(registry, industryService),
      registry,
      industryService,
    };
  }

  describe('GET /demos (list)', () => {
    it('filtra el catálogo a los demos habilitados del tenant', async () => {
      const { controller, registry, industryService } = makeController({
        findAll: vi.fn(() => [sampleDemo, otherDemo]),
        resolveEnabledDemos: vi.fn(async () => ({
          tenant: {
            id: TENANT_ID,
            slug: 'a',
            displayName: 'A',
            branding: {},
            status: 'active' as const,
          },
          industry: {
            slug: 'universidad',
            displayName: 'Educación',
            defaultConfig: {},
          },
          // solo rag está habilitado
          enabledDemos: ['rag'],
          overridden: false,
        })),
      });

      const result = await controller.list(TENANT_ID);

      expect(result).toEqual([sampleDemo]); // tutor queda afuera
      expect(industryService.resolveEnabledDemos).toHaveBeenCalledWith(
        TENANT_ID,
      );
      expect(registry.findAll).toHaveBeenCalledOnce();
    });

    it('devuelve lista vacía si el tenant no tiene ningún demo habilitado', async () => {
      const { controller } = makeController({
        findAll: vi.fn(() => [sampleDemo, otherDemo]),
        resolveEnabledDemos: vi.fn(async () => ({
          tenant: {
            id: TENANT_ID,
            slug: 'a',
            displayName: 'A',
            branding: {},
            status: 'active' as const,
          },
          industry: {
            slug: 'universidad',
            displayName: 'Educación',
            defaultConfig: {},
          },
          enabledDemos: [],
          overridden: false,
        })),
      });

      const result = await controller.list(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('GET /demos/:id (detail)', () => {
    it('devuelve el demo cuando existe y está habilitado para el tenant', async () => {
      const { controller, registry, industryService } = makeController({
        findOne: vi.fn(() => sampleDemo),
        hasDemo: vi.fn(async () => true),
      });

      const result = await controller.detail('rag', TENANT_ID);
      expect(result).toBe(sampleDemo);
      expect(registry.findOne).toHaveBeenCalledWith('rag');
      expect(industryService.hasDemo).toHaveBeenCalledWith(TENANT_ID, 'rag');
    });

    it('lanza 404 con el id en el mensaje cuando NO existe', async () => {
      const { controller } = makeController({
        findOne: vi.fn(() => null),
      });

      await expect(controller.detail('inexistente', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.detail('inexistente', TENANT_ID)).rejects.toThrow(
        /inexistente/,
      );
    });

    it('lanza 404 cuando existe pero NO está habilitado para el tenant (sin filtrar existencia)', async () => {
      const { controller } = makeController({
        findOne: vi.fn(() => sampleDemo),
        hasDemo: vi.fn(async () => false),
      });

      // Mismo error que "no existe" — no queremos confirmar que el demo
      // existe pero está deshabilitado para este tenant.
      await expect(controller.detail('rag', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
