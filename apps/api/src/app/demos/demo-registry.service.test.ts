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
    it('devuelve los 9 demos del roadmap (rag, comparator, corpus, agent, tutor, clinical, interview, notarize, loans)', () => {
      const demos = service.findAll();
      const ids = demos.map((d) => d.id);
      expect(ids).toEqual([
        'rag',
        'comparator',
        'corpus',
        'agent',
        'tutor',
        'clinical',
        'interview',
        'notarize',
        'loans',
      ]);
    });

    it('marca los 8 demos terminados como available y loans como coming-soon', () => {
      // Cierre del sprint Demo 08 (NotarizeModule): notarize pasó a
      // 'available'. Demo 09 (loans) entra como 'coming-soon' en sub-PR 1
      // y pasa a 'available' en sub-PR 5.
      const demos = service.findAll();
      const byId = Object.fromEntries(demos.map((d) => [d.id, d.status]));
      expect(byId.rag).toBe('available');
      expect(byId.comparator).toBe('available');
      expect(byId.corpus).toBe('available');
      expect(byId.agent).toBe('available');
      expect(byId.tutor).toBe('available');
      expect(byId.clinical).toBe('available');
      expect(byId.interview).toBe('available');
      expect(byId.notarize).toBe('available');
      expect(byId.loans).toBe('coming-soon');
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
