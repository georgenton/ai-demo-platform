// -----------------------------------------------------------------------------
// Tests del DemosController.
//
// Solo nos importa el comportamiento HTTP del controller:
//   - list() devuelve lo que el registry devuelve.
//   - detail() devuelve el demo si existe, lanza 404 si no.
//
// El registry se pasa stubbeado — no es el SUT (system under test). Los tests
// del catálogo en sí viven en demo-registry.service.test.ts.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DemosController } from './demos.controller.js';
import type { DemoRegistryService } from './demo-registry.service.js';
import type { DemoMetadata } from './demo-registry.types.js';

const sampleDemo: DemoMetadata = {
  id: 'rag',
  title: 'Sample',
  tagline: 'Tagline',
  description: 'Description',
  audience: ['Universidades'],
  status: 'available',
  route: '/demo/rag',
};

describe('DemosController', () => {
  function makeController(stubs: {
    findAll?: ReturnType<typeof vi.fn>;
    findOne?: ReturnType<typeof vi.fn>;
  }) {
    const registry = {
      findAll: stubs.findAll ?? vi.fn(),
      findOne: stubs.findOne ?? vi.fn(),
    } as unknown as DemoRegistryService;
    return { controller: new DemosController(registry), registry };
  }

  describe('GET /demos (list)', () => {
    it('delega en registry.findAll() y devuelve el resultado', () => {
      const all = [sampleDemo];
      const { controller, registry } = makeController({
        findAll: vi.fn(() => all),
      });

      expect(controller.list()).toBe(all);
      expect(registry.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('GET /demos/:id (detail)', () => {
    it('devuelve el demo cuando registry.findOne() lo encuentra', () => {
      const { controller, registry } = makeController({
        findOne: vi.fn(() => sampleDemo),
      });

      expect(controller.detail('rag')).toBe(sampleDemo);
      expect(registry.findOne).toHaveBeenCalledWith('rag');
    });

    it('lanza NotFoundException con mensaje útil cuando no existe', () => {
      const { controller } = makeController({
        findOne: vi.fn(() => null),
      });

      // toThrow con un regex que matchea el ID — así la UX del error queda
      // garantizada (mensaje que ayude a debug, no genérico "Not Found").
      expect(() => controller.detail('inexistente')).toThrow(NotFoundException);
      expect(() => controller.detail('inexistente')).toThrow(/inexistente/);
    });
  });
});
