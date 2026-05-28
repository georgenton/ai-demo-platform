// -----------------------------------------------------------------------------
// Tests del DemoRegistryService.
//
// Es un service "datos planos" — sin dependencias externas, sin red, sin DB.
// Los tests verifican:
//   - El catálogo trae los IDs del roadmap: los 4 del CLAUDE.md original
//     (rag, comparator, corpus, agent) + tutor (Demo 05, ADR-0012).
//   - Los 4 demos cerrados quedan en `available`; tutor en `coming-soon`
//     mientras dura el sprint Demo 05.
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

    it('marca los 4 demos cerrados como available y tutor como coming-soon', () => {
      // Sprint Demo 03 (2026-05-28): rag/comparator/corpus/agent quedaron
      // 'available'. Sprint Demo 05 (en curso): tutor entró al catálogo
      // como 'coming-soon' para que la UI lo muestre deshabilitado
      // mientras se construye. Cuando termine el sprint Demo 05, tutor
      // pasa a 'available' y este test cambia con él.
      const demos = service.findAll();
      const byId = Object.fromEntries(demos.map((d) => [d.id, d.status]));
      expect(byId.rag).toBe('available');
      expect(byId.comparator).toBe('available');
      expect(byId.corpus).toBe('available');
      expect(byId.agent).toBe('available');
      expect(byId.tutor).toBe('coming-soon');
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
