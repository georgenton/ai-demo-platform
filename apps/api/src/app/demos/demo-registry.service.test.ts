// -----------------------------------------------------------------------------
// Tests del DemoRegistryService.
//
// Es un service "datos planos" — sin dependencias externas, sin red, sin DB.
// Los tests verifican:
//   - El catálogo trae los IDs del roadmap: los 4 del CLAUDE.md original
//     (rag, comparator, corpus, agent) + tutor (Demo 05, ADR-0012).
//   - Los 5 demos quedan en `available` después del cierre del sprint
//     Demo 05 (PR-E). Si en algún momento se suma un demo nuevo
//     'coming-soon', este test cambia con él.
//   - findOne() devuelve el demo si existe y null si no.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { DemoRegistryService } from './demo-registry.service.js';

describe('DemoRegistryService', () => {
  const service = new DemoRegistryService();

  describe('findAll()', () => {
    it('devuelve los 5 demos del roadmap (rag, comparator, corpus, agent, tutor)', () => {
      const demos = service.findAll();
      const ids = demos.map((d) => d.id);
      expect(ids).toEqual(['rag', 'comparator', 'corpus', 'agent', 'tutor']);
    });

    it('marca los 5 demos del roadmap como available', () => {
      // Cierre del sprint Demo 05 (PR-E): tutor pasó a 'available'. Todos los
      // demos del roadmap están funcionales. Si en algún momento se suma un
      // demo nuevo 'coming-soon', conviene volver al patrón "key por key" de
      // antes en lugar de iterar.
      const demos = service.findAll();
      const byId = Object.fromEntries(demos.map((d) => [d.id, d.status]));
      expect(byId.rag).toBe('available');
      expect(byId.comparator).toBe('available');
      expect(byId.corpus).toBe('available');
      expect(byId.agent).toBe('available');
      expect(byId.tutor).toBe('available');
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
