// -----------------------------------------------------------------------------
// Tests del DemoRegistryService.
//
// Es un service "datos planos" — sin dependencias externas, sin red, sin DB.
// Los tests verifican:
//   - El catálogo no está vacío y trae los IDs que prometemos en CLAUDE.md
//     (rag, comparator, corpus, agent).
//   - Demo 01 (rag) está marcado como `available` — es el que se presenta.
//   - findOne() devuelve el demo si existe y null si no.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { DemoRegistryService } from './demo-registry.service.js';

describe('DemoRegistryService', () => {
  const service = new DemoRegistryService();

  describe('findAll()', () => {
    it('devuelve los 4 demos del roadmap (rag, comparator, corpus, agent)', () => {
      const demos = service.findAll();
      const ids = demos.map((d) => d.id);
      expect(ids).toEqual(['rag', 'comparator', 'corpus', 'agent']);
    });

    it('marca a Demo 01 (rag) como available y al resto como coming-soon', () => {
      const demos = service.findAll();
      const byId = Object.fromEntries(demos.map((d) => [d.id, d.status]));
      expect(byId.rag).toBe('available');
      expect(byId.comparator).toBe('coming-soon');
      expect(byId.corpus).toBe('coming-soon');
      expect(byId.agent).toBe('coming-soon');
    });

    it('todos los demos traen los campos requeridos por la UI', () => {
      // Verificación blanda — si alguien agrega un demo nuevo y se olvida
      // un campo, este test grita antes de que llegue a producción.
      for (const demo of service.findAll()) {
        expect(demo.id).toBeTruthy();
        expect(demo.title).toBeTruthy();
        expect(demo.tagline).toBeTruthy();
        expect(demo.description).toBeTruthy();
        expect(demo.audience.length).toBeGreaterThan(0);
        expect(demo.route).toMatch(/^\/demo\//);
      }
    });
  });

  describe('findOne()', () => {
    it('devuelve el demo si el id existe', () => {
      const demo = service.findOne('rag');
      expect(demo).not.toBeNull();
      expect(demo?.id).toBe('rag');
      expect(demo?.title).toBeTruthy();
    });

    it('devuelve null si el id no existe', () => {
      expect(service.findOne('inexistente')).toBeNull();
    });
  });
});
