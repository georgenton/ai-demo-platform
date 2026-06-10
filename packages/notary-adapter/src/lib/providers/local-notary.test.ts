// -----------------------------------------------------------------------------
// Tests del LocalNotaryAdapter — sub-PR 2.
//
// Estrategia: mock estructural del cliente Prisma. Cero BD real, cero
// dependencia de Postgres. Los tests cubren:
//   - getOrCreateTenantKey idempotente (1 generación por tenant).
//   - anchor() genera shape correcto + persiste con sequence/prev/hash/sig.
//   - 2 anchors seguidos forman la cadena (prevAnchorHash del segundo =
//     anchorHash del primero).
//   - 2 tenants tienen ledgers independientes (sequences paralelas
//     arrancando en 0).
//   - verify() golden path (anchor recién creado verifica OK).
//   - verify() detecta contentHash alterado.
//   - verify() detecta firma alterada.
//   - verify() rechaza anchor inexistente / inputs malformados.
//   - Validación de inputs en anchor().
// -----------------------------------------------------------------------------

import { describe, expect, it, beforeEach } from 'vitest';

import { sha256Hex } from '../crypto-utils.js';

import {
  LocalNotaryAdapter,
  type LocalAnchorRecord,
  type LocalNotaryDb,
  type TenantNotaryKeyRecord,
} from './local-notary.js';

const MASTER_KEY = 'a'.repeat(64); // 32 bytes en hex
const VALID_HASH = sha256Hex('contenido del PDF');
const ALTERED_HASH = sha256Hex('contenido del PDF (modificado)');

/**
 * Fake DB en memoria con la misma interface estructural que `LocalNotaryDb`.
 *
 * Implementa lo mínimo: dos tablas en arrays + el `$transaction` que
 * simplemente ejecuta el callback contra el mismo store (sin aislamiento
 * real — basta para los tests).
 */
function makeFakeDb(): LocalNotaryDb & {
  anchors: LocalAnchorRecord[];
  keys: TenantNotaryKeyRecord[];
} {
  const anchors: LocalAnchorRecord[] = [];
  const keys: TenantNotaryKeyRecord[] = [];
  let idSeq = 0;
  const nextId = () => `id-${++idSeq}`;

  const db: LocalNotaryDb & {
    anchors: LocalAnchorRecord[];
    keys: TenantNotaryKeyRecord[];
  } = {
    anchors,
    keys,
    tenantNotaryKey: {
      async findUnique({ where }) {
        return keys.find((k) => k.tenantId === where.tenantId) ?? null;
      },
      async create({ data }) {
        const created: TenantNotaryKeyRecord = {
          id: nextId(),
          tenantId: data.tenantId,
          algorithm: data.algorithm,
          publicKeyPem: data.publicKeyPem,
          privateKeyEncrypted: data.privateKeyEncrypted,
          fingerprint: data.fingerprint,
          activatedAt: new Date(),
          deactivatedAt: null,
        };
        keys.push(created);
        return created;
      },
    },
    localAnchor: {
      async findFirst({ where, orderBy }) {
        const filtered = anchors.filter((a) => a.tenantId === where.tenantId);
        if (orderBy.sequence === 'desc') {
          filtered.sort((a, b) => b.sequence - a.sequence);
        }
        return filtered[0] ?? null;
      },
      async findUnique({ where }) {
        return anchors.find((a) => a.id === where.id) ?? null;
      },
      async create({ data }) {
        // Replica el unique (tenantId, sequence) del schema real.
        const dup = anchors.find(
          (a) => a.tenantId === data.tenantId && a.sequence === data.sequence,
        );
        if (dup) {
          throw new Error(
            `Unique violation: (tenantId=${data.tenantId}, sequence=${data.sequence}) ya existe.`,
          );
        }
        const created: LocalAnchorRecord = {
          id: nextId(),
          documentId: data.documentId,
          tenantId: data.tenantId,
          sequence: data.sequence,
          prevAnchorHash: data.prevAnchorHash,
          anchorHash: data.anchorHash,
          signature: data.signature,
          signerKeyId: data.signerKeyId,
          createdAt: data.createdAt,
        };
        anchors.push(created);
        return created;
      },
    },
    async $transaction<T>(fn: (tx: LocalNotaryDb) => Promise<T>): Promise<T> {
      // Fake tx — sin rollback ni aislamiento. Suficiente para tests; la
      // atomicidad real la da Prisma+Postgres en runtime.
      return fn(db);
    },
  };

  return db;
}

let now = 1_700_000_000_000;
function makeClock() {
  return () => {
    now += 1; // monotónico para evitar timestamps duplicados en una serie
    return now;
  };
}

describe('LocalNotaryAdapter', () => {
  beforeEach(() => {
    now = 1_700_000_000_000;
  });

  it('rechaza master key con longitud incorrecta', () => {
    expect(
      () =>
        new LocalNotaryAdapter({
          db: makeFakeDb(),
          masterKey: 'demasiado-corto',
        }),
    ).toThrow(/64 chars/);
  });

  // -------------------------------------------------------------------------
  // anchor() — validaciones
  // -------------------------------------------------------------------------

  it('anchor rechaza contentHash mal formado', async () => {
    const adapter = new LocalNotaryAdapter({
      db: makeFakeDb(),
      masterKey: MASTER_KEY,
    });
    await expect(
      adapter.anchor({
        contentHash: 'corto',
        tenantId: 't',
        documentId: 'd',
      }),
    ).rejects.toThrow(/64 chars/);
  });

  it('anchor rechaza tenantId vacío', async () => {
    const adapter = new LocalNotaryAdapter({
      db: makeFakeDb(),
      masterKey: MASTER_KEY,
    });
    await expect(
      adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: '',
        documentId: 'd',
      }),
    ).rejects.toThrow(/tenantId/);
  });

  it('anchor rechaza documentId vacío', async () => {
    const adapter = new LocalNotaryAdapter({
      db: makeFakeDb(),
      masterKey: MASTER_KEY,
    });
    await expect(
      adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: '',
      }),
    ).rejects.toThrow(/documentId/);
  });

  // -------------------------------------------------------------------------
  // getOrCreateTenantKey — idempotencia (validada vía side effect)
  // -------------------------------------------------------------------------

  it('genera la keypair del tenant en el primer anchor y la reusa en el segundo', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-1',
    });
    expect(db.keys.length).toBe(1);

    await adapter.anchor({
      contentHash: ALTERED_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-2',
    });
    expect(db.keys.length).toBe(1); // misma key reusada
  });

  // -------------------------------------------------------------------------
  // anchor() — golden path + shape
  // -------------------------------------------------------------------------

  it('anchor primer documento → sequence=0 + prevHash=GENESIS', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    const result = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-1',
    });

    expect(result.provider).toBe('local');
    expect(result.status).toBe('confirmed');
    expect(result.anchoredAt).toBeInstanceOf(Date);

    // El anchor persistido tiene sequence=0 y prevHash al GENESIS.
    expect(db.anchors.length).toBe(1);
    expect(db.anchors[0].sequence).toBe(0);
    expect(db.anchors[0].prevAnchorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.anchors[0].anchorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.anchors[0].signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(db.anchors[0].signerKeyId).toMatch(/^[0-9a-f]{16}$/);

    // El AnchorResult expone los mismos campos en `details`.
    expect(result.details).toMatchObject({
      sequence: 0,
      prevAnchorHash: db.anchors[0].prevAnchorHash,
      anchorHash: db.anchors[0].anchorHash,
      signerKeyId: db.anchors[0].signerKeyId,
    });
  });

  it('anchors sucesivos del MISMO tenant forman la cadena (prev = anchor anterior)', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-1',
    });
    await adapter.anchor({
      contentHash: ALTERED_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-2',
    });
    await adapter.anchor({
      contentHash: sha256Hex('doc-3'),
      tenantId: 'tenant-utpl',
      documentId: 'doc-3',
    });

    expect(db.anchors.length).toBe(3);
    expect(db.anchors[0].sequence).toBe(0);
    expect(db.anchors[1].sequence).toBe(1);
    expect(db.anchors[2].sequence).toBe(2);

    // La cadena: cada prev es el anchorHash del anterior.
    expect(db.anchors[1].prevAnchorHash).toBe(db.anchors[0].anchorHash);
    expect(db.anchors[2].prevAnchorHash).toBe(db.anchors[1].anchorHash);
  });

  it('anchors de tenants distintos arrancan en sequence=0 independientes', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-A',
      documentId: 'doc-A1',
    });
    await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-B',
      documentId: 'doc-B1',
    });

    const a = db.anchors.find((x) => x.tenantId === 'tenant-A')!;
    const b = db.anchors.find((x) => x.tenantId === 'tenant-B')!;
    expect(a.sequence).toBe(0);
    expect(b.sequence).toBe(0);
    expect(a.anchorHash).not.toBe(b.anchorHash); // tenantId entra al hash
    expect(db.keys.length).toBe(2); // dos keypairs distintos
  });

  // -------------------------------------------------------------------------
  // verify() — golden path + casos negativos
  // -------------------------------------------------------------------------

  it('verify del anchor recién creado devuelve valid=true', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    const a = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-1',
    });
    const v = await adapter.verify(a.anchorId, VALID_HASH);
    expect(v.valid).toBe(true);
    expect(v.provider).toBe('local');
    expect(v.details).toMatchObject({ sequence: 0 });
  });

  it('verify con contentHash alterado → valid=false con razón clara', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    const a = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 't',
      documentId: 'd',
    });
    const v = await adapter.verify(a.anchorId, ALTERED_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/no matchea/);
  });

  it('verify con firma alterada → valid=false (detect tampering)', async () => {
    const db = makeFakeDb();
    const adapter = new LocalNotaryAdapter({
      db,
      masterKey: MASTER_KEY,
      now: makeClock(),
    });

    const a = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 't',
      documentId: 'd',
    });
    // Altera la firma DIRECTAMENTE en la fake DB para simular tampering.
    const stored = db.anchors.find((x) => x.id === a.anchorId)!;
    const sigBytes = Buffer.from(stored.signature, 'base64');
    sigBytes[0] = sigBytes[0] === 0 ? 1 : 0; // flip un byte
    stored.signature = sigBytes.toString('base64');

    const v = await adapter.verify(a.anchorId, VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/firma inválida/);
  });

  it('verify de anchor inexistente → valid=false', async () => {
    const adapter = new LocalNotaryAdapter({
      db: makeFakeDb(),
      masterKey: MASTER_KEY,
    });
    const v = await adapter.verify('id-que-no-existe', VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/no encontrado/);
  });

  it('verify con anchorId vacío o contentHash mal formado → valid=false', async () => {
    const adapter = new LocalNotaryAdapter({
      db: makeFakeDb(),
      masterKey: MASTER_KEY,
    });
    const v1 = await adapter.verify('', VALID_HASH);
    expect(v1.valid).toBe(false);
    expect(v1.reason).toMatch(/vacío/);

    const v2 = await adapter.verify('id-1', 'corto');
    expect(v2.valid).toBe(false);
    expect(v2.reason).toMatch(/contentHash inválido/);
  });
});
