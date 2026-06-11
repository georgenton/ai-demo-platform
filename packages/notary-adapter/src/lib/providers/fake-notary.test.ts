// -----------------------------------------------------------------------------
// Tests del FakeNotaryAdapter. Cubre las propiedades clave del adapter:
//   1. anchor() es determinístico (mismo input → mismo anchorId).
//   2. anchor() valida inputs malformados.
//   3. verify() acepta anchorId+contentHash bien formados.
//   4. verify() rechaza tampered contentHash con razón clara.
//   5. anchor/verify ida-y-vuelta funcionan en pareja (golden path).
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { FakeNotaryAdapter } from './fake-notary.js';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const VALID_HASH = sha256Hex('contenido del PDF de prueba');
const TENANT = 'tenant-cooperativa-utpl';
const DOC = 'doc-acta-001';

describe('FakeNotaryAdapter.anchor()', () => {
  it('devuelve un anchor con shape correcto', async () => {
    const fake = new FakeNotaryAdapter();
    const result = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });

    expect(result.provider).toBe('fake');
    expect(result.status).toBe('confirmed');
    expect(result.anchorId).toMatch(/^[0-9a-f]{64}$/);
    expect(result.anchoredAt).toBeInstanceOf(Date);
    expect(result.details).toHaveProperty('derivedFrom');
  });

  it('es determinístico: mismos inputs → mismo anchorId', async () => {
    const fake = new FakeNotaryAdapter();
    const r1 = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });
    const r2 = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });
    expect(r1.anchorId).toBe(r2.anchorId);
  });

  it('cambiar contentHash cambia el anchorId', async () => {
    const fake = new FakeNotaryAdapter();
    const r1 = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });
    const altered = sha256Hex('contenido del PDF de prueba (modificado)');
    const r2 = await fake.anchor({
      contentHash: altered,
      tenantId: TENANT,
      documentId: DOC,
    });
    expect(r1.anchorId).not.toBe(r2.anchorId);
  });

  it('cambiar tenantId cambia el anchorId (aislamiento multi-tenant)', async () => {
    const fake = new FakeNotaryAdapter();
    const r1 = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-A',
      documentId: DOC,
    });
    const r2 = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-B',
      documentId: DOC,
    });
    expect(r1.anchorId).not.toBe(r2.anchorId);
  });

  it('rechaza contentHash que no es SHA-256 hex de 64 chars', async () => {
    const fake = new FakeNotaryAdapter();
    await expect(
      fake.anchor({
        contentHash: 'demasiado-corto',
        tenantId: TENANT,
        documentId: DOC,
      }),
    ).rejects.toThrow(/64 chars/);
  });

  it('rechaza tenantId vacío', async () => {
    const fake = new FakeNotaryAdapter();
    await expect(
      fake.anchor({
        contentHash: VALID_HASH,
        tenantId: '',
        documentId: DOC,
      }),
    ).rejects.toThrow(/tenantId/);
  });

  it('rechaza documentId vacío', async () => {
    const fake = new FakeNotaryAdapter();
    await expect(
      fake.anchor({
        contentHash: VALID_HASH,
        tenantId: TENANT,
        documentId: '',
      }),
    ).rejects.toThrow(/documentId/);
  });
});

describe('FakeNotaryAdapter.verify()', () => {
  it('acepta anchorId+contentHash bien formados', async () => {
    const fake = new FakeNotaryAdapter();
    const a = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });

    const v = await fake.verify(a.anchorId, VALID_HASH);
    expect(v.valid).toBe(true);
    expect(v.provider).toBe('fake');
    expect(v.reason).toBeUndefined();
  });

  it('rechaza contentHash inválido con razón clara', async () => {
    const fake = new FakeNotaryAdapter();
    const a = await fake.anchor({
      contentHash: VALID_HASH,
      tenantId: TENANT,
      documentId: DOC,
    });

    const v = await fake.verify(a.anchorId, 'no-es-sha256');
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/contentHash inválido/);
  });

  it('rechaza anchorId con shape incorrecto', async () => {
    const fake = new FakeNotaryAdapter();
    const v = await fake.verify('no-es-hex-de-64', VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/shape/);
  });

  it('rechaza anchorId vacío', async () => {
    const fake = new FakeNotaryAdapter();
    const v = await fake.verify('', VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/vacío/);
  });
});
