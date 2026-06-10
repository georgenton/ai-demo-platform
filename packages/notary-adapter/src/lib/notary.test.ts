// -----------------------------------------------------------------------------
// Tests del factory + cache de notary.ts.
//
// Verifica que:
//   1. isValidNotaryProvider acepta solo los providers conocidos.
//   2. createNotaryAdapter instancia el adapter correcto por provider.
//   3. createNotaryAdapter(local) sin deps falla con mensaje claro.
//   4. createNotaryAdapter(polygon) sin deps falla con mensaje claro.
//   5. notaryFor cachea entre llamadas (mismo provider devuelve misma
//      instancia).
//   6. resetNotaryCache limpia el cache.
//   7. Los stubs Local/Polygon lanzan "no implementado" en anchor/verify.
// -----------------------------------------------------------------------------

import { afterEach, describe, expect, it } from 'vitest';

import { FakeNotaryAdapter } from './providers/fake-notary.js';
import { LocalNotaryAdapter } from './providers/local-notary.js';
import { PolygonNotaryAdapter } from './providers/polygon-notary.js';
import {
  createNotaryAdapter,
  isValidNotaryProvider,
  notaryFor,
  resetNotaryCache,
} from './notary.js';

afterEach(() => {
  // Limpia el cache entre tests para no contaminar.
  resetNotaryCache();
});

describe('isValidNotaryProvider', () => {
  it('acepta los providers conocidos', () => {
    expect(isValidNotaryProvider('local')).toBe(true);
    expect(isValidNotaryProvider('polygon')).toBe(true);
    expect(isValidNotaryProvider('fake')).toBe(true);
  });

  it('rechaza strings desconocidos', () => {
    expect(isValidNotaryProvider('hyperledger')).toBe(false);
    expect(isValidNotaryProvider('')).toBe(false);
    expect(isValidNotaryProvider('Fake')).toBe(false); // case-sensitive
  });
});

describe('createNotaryAdapter', () => {
  it('crea FakeNotaryAdapter sin deps', () => {
    const a = createNotaryAdapter('fake');
    expect(a).toBeInstanceOf(FakeNotaryAdapter);
  });

  it('crea LocalNotaryAdapter cuando llegan deps.local', () => {
    const a = createNotaryAdapter('local', {
      local: { db: {}, masterKey: 'a'.repeat(64) },
    });
    expect(a).toBeInstanceOf(LocalNotaryAdapter);
  });

  it('falla si pide local sin deps.local', () => {
    expect(() => createNotaryAdapter('local')).toThrow(/deps\.local/);
  });

  it('crea PolygonNotaryAdapter cuando llegan deps.polygon', () => {
    const a = createNotaryAdapter('polygon', {
      polygon: { signer: {}, network: 'polygon-mumbai' },
    });
    expect(a).toBeInstanceOf(PolygonNotaryAdapter);
  });

  it('falla si pide polygon sin deps.polygon', () => {
    expect(() => createNotaryAdapter('polygon')).toThrow(/deps\.polygon/);
  });
});

describe('notaryFor (cache)', () => {
  it('devuelve la misma instancia en llamadas sucesivas con mismo provider', () => {
    const a = notaryFor('fake');
    const b = notaryFor('fake');
    expect(a).toBe(b);
  });

  it('devuelve instancias DISTINTAS para providers distintos', () => {
    const fake = notaryFor('fake');
    const local = notaryFor('local', {
      local: { db: {}, masterKey: 'a'.repeat(64) },
    });
    expect(fake).not.toBe(local);
  });

  it('resetNotaryCache fuerza nueva instancia', () => {
    const a = notaryFor('fake');
    resetNotaryCache();
    const b = notaryFor('fake');
    expect(a).not.toBe(b);
  });
});

// PolygonNotaryAdapter sigue siendo stub hasta sub-PR 3. LocalNotaryAdapter
// ya está implementado — sus tests viven en `providers/local-notary.test.ts`.
describe('Stub PolygonNotaryAdapter (sub-PR 1)', () => {
  it('PolygonNotaryAdapter.anchor() lanza "no implementado"', async () => {
    const a = createNotaryAdapter('polygon', {
      polygon: { signer: {}, network: 'polygon-mumbai' },
    });
    await expect(
      a.anchor({
        contentHash: 'a'.repeat(64),
        tenantId: 't',
        documentId: 'd',
      }),
    ).rejects.toThrow(/sub-PR 3/);
  });
});
