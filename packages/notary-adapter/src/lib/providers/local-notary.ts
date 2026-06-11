// -----------------------------------------------------------------------------
// LocalNotaryAdapter — mini-ledger interno firmado (ADR-0019, sub-PR 2).
//
// Una entrada por documento del tenant en `LocalAnchor`, encadenada con
// `prevAnchorHash` al anchor anterior del MISMO tenant, firmada con la
// clave RSA del tenant. Cualquier alteración rompe la cadena de forma
// detectable por verificación matemática.
//
// Flujo de `anchor(req)`:
//
//   1. Resolver la `TenantNotaryKey` del tenant (la genera si no existe).
//   2. Abrir una transacción interactiva en la BD.
//   3. Leer el ÚLTIMO `LocalAnchor` del tenant (por sequence desc).
//      sequence = (último?.sequence ?? -1) + 1.
//      prevAnchorHash = último?.anchorHash ?? GENESIS_PREV_HASH.
//   4. Calcular `anchorHash = SHA-256(contentHash || prev || sequence ||
//      timestampMs || tenantId)`.
//   5. Firmar `anchorHash` con la privada (RSA-PSS-SHA256).
//   6. INSERT del nuevo `LocalAnchor`.
//   7. Devolver `AnchorResult`.
//
// La transacción + el unique constraint en `(tenantId, sequence)` aseguran
// que dos requests racing sobre el mismo tenant no generan anchors con la
// misma sequence (uno gana, el otro recibe error de unique violation que
// el caller puede retentar).
//
// Flujo de `verify(anchorId, contentHash)`:
//
//   1. Buscar el `LocalAnchor` por su `id` (no por anchorHash — anchorId
//      es el ID del registro).
//   2. Recalcular `anchorHash` desde los campos guardados y el
//      contentHash provisto.
//   3. Si no coincide → invalid ("contentHash no matchea").
//   4. Resolver la `TenantNotaryKey` por `signerKeyId`.
//   5. Verificar la firma con la pública.
//   6. Devolver `{ valid, details }`.
// -----------------------------------------------------------------------------

import {
  computeAnchorHash,
  decryptWithMasterKey,
  encryptWithMasterKey,
  GENESIS_PREV_HASH,
  generateKeypair,
  parseMasterKey,
  signWithPrivateKey,
  verifySignature,
} from '../crypto-utils.js';
import type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '../types.js';

/** SHA-256 en hex = exactamente 64 chars `[0-9a-f]`. */
const HEX_64_REGEX = /^[0-9a-f]{64}$/i;

// ---------------------------------------------------------------------------
// Tipos estructurales del cliente Prisma.
//
// Definidos como interface mínima para que el adapter NO dependa de
// `@org/db` (evita dependencias circulares y permite tests sin Prisma
// real). El cliente Prisma real matchea por estructura.
// ---------------------------------------------------------------------------

/** Subset de TenantNotaryKey que el adapter consume. */
export interface TenantNotaryKeyRecord {
  id: string;
  tenantId: string;
  algorithm: string;
  publicKeyPem: string;
  privateKeyEncrypted: string;
  fingerprint: string;
  activatedAt: Date;
  deactivatedAt: Date | null;
}

/** Subset de LocalAnchor que el adapter consume. */
export interface LocalAnchorRecord {
  id: string;
  documentId: string;
  tenantId: string;
  sequence: number;
  prevAnchorHash: string;
  anchorHash: string;
  signature: string;
  signerKeyId: string;
  createdAt: Date;
}

/**
 * Interface estructural del cliente Prisma — solo los métodos que el
 * adapter usa. Tanto el cliente real como un mock pasan por acá vía
 * structural typing.
 */
export interface LocalNotaryDb {
  tenantNotaryKey: {
    findUnique(args: {
      where: { tenantId: string };
    }): Promise<TenantNotaryKeyRecord | null>;
    create(args: {
      data: Omit<TenantNotaryKeyRecord, 'id' | 'activatedAt' | 'deactivatedAt'>;
    }): Promise<TenantNotaryKeyRecord>;
  };
  localAnchor: {
    findFirst(args: {
      where: { tenantId: string };
      orderBy: { sequence: 'desc' };
    }): Promise<LocalAnchorRecord | null>;
    findUnique(args: {
      where: { id: string };
    }): Promise<LocalAnchorRecord | null>;
    create(args: {
      data: Omit<LocalAnchorRecord, 'id' | 'createdAt'> & { createdAt: Date };
    }): Promise<LocalAnchorRecord>;
  };
  $transaction<T>(fn: (tx: LocalNotaryDb) => Promise<T>): Promise<T>;
}

export interface LocalNotaryDeps {
  /** Cliente Prisma (o mock con la misma interface estructural). */
  db: LocalNotaryDb;
  /**
   * Master key del env (`NOTARY_MASTER_KEY`). 32 bytes en hex (64 chars).
   * Generarla con `openssl rand -hex 32`.
   */
  masterKey: string;
  /**
   * Override opcional del clock. Útil para tests determinísticos (golden
   * vectors). En producción se omite y usa `Date.now()`.
   */
  now?: () => number;
}

export class LocalNotaryAdapter implements NotaryAdapter {
  private readonly db: LocalNotaryDb;
  private readonly masterKey: Buffer;
  private readonly now: () => number;

  constructor(deps: LocalNotaryDeps) {
    this.db = deps.db;
    // Validar la master key al construir — falla rápido si está mal en el
    // env, en vez de esperar al primer anchor en producción.
    this.masterKey = parseMasterKey(deps.masterKey);
    this.now = deps.now ?? (() => Date.now());
  }

  // -------------------------------------------------------------------------
  // anchor() — genera un nuevo LocalAnchor.
  // -------------------------------------------------------------------------

  async anchor(req: AnchorRequest): Promise<AnchorResult> {
    if (!req.contentHash || !HEX_64_REGEX.test(req.contentHash)) {
      throw new Error(
        'LocalNotaryAdapter.anchor: contentHash debe ser hex de 64 chars (SHA-256).',
      );
    }
    if (!req.tenantId) {
      throw new Error('LocalNotaryAdapter.anchor: tenantId requerido.');
    }
    if (!req.documentId) {
      throw new Error('LocalNotaryAdapter.anchor: documentId requerido.');
    }

    // 1. Resolver (o crear) la keypair del tenant. FUERA de la
    //    transacción del paso 2 porque generar el keypair es lento
    //    (~50–200ms) y no queremos lockear el ledger todo ese tiempo.
    const key = await this.getOrCreateTenantKey(req.tenantId);
    const privateKeyPem = decryptWithMasterKey(
      key.privateKeyEncrypted,
      this.masterKey,
    );

    // 2. Tx interactiva — lee el último anchor del tenant + escribe el
    //    nuevo en la misma unidad atómica. El unique (tenantId, sequence)
    //    es la salvaguarda final si dos requests racing del MISMO tenant
    //    pasan el check en paralelo: uno gana, el otro tira P2002 que el
    //    caller puede retentar.
    const result = await this.db.$transaction(async (tx) => {
      const last = await tx.localAnchor.findFirst({
        where: { tenantId: req.tenantId },
        orderBy: { sequence: 'desc' },
      });
      const sequence = last ? last.sequence + 1 : 0;
      const prevAnchorHash = last ? last.anchorHash : GENESIS_PREV_HASH;
      const timestampMs = this.now();
      const anchorHash = computeAnchorHash({
        contentHash: req.contentHash,
        prevAnchorHash,
        sequence,
        timestampMs,
        tenantId: req.tenantId,
      });
      const signature = signWithPrivateKey(anchorHash, privateKeyPem);
      const createdAt = new Date(timestampMs);
      const created = await tx.localAnchor.create({
        data: {
          documentId: req.documentId,
          tenantId: req.tenantId,
          sequence,
          prevAnchorHash,
          anchorHash,
          signature,
          signerKeyId: key.fingerprint,
          createdAt,
        },
      });
      return created;
    });

    return {
      anchorId: result.id,
      provider: 'local',
      status: 'confirmed',
      anchoredAt: result.createdAt,
      details: {
        sequence: result.sequence,
        prevAnchorHash: result.prevAnchorHash,
        anchorHash: result.anchorHash,
        signerKeyId: result.signerKeyId,
        algorithm: key.algorithm,
      },
    };
  }

  // -------------------------------------------------------------------------
  // verify() — confirma que un anchor existente es coherente.
  // -------------------------------------------------------------------------

  async verify(
    anchorId: string,
    contentHash: string,
  ): Promise<VerificationResult> {
    if (!anchorId) {
      return {
        valid: false,
        provider: 'local',
        reason: 'anchorId vacío',
        details: {},
      };
    }
    if (!contentHash || !HEX_64_REGEX.test(contentHash)) {
      return {
        valid: false,
        provider: 'local',
        reason: 'contentHash inválido (no es SHA-256 hex de 64 chars)',
        details: {},
      };
    }

    const anchor = await this.db.localAnchor.findUnique({
      where: { id: anchorId },
    });
    if (!anchor) {
      return {
        valid: false,
        provider: 'local',
        reason: 'anchor no encontrado',
        details: {},
      };
    }

    // Recalcular el anchorHash con el contentHash provisto. Si el PDF
    // original fue alterado, contentHash será otro y el recalculo no
    // matcheará.
    const recomputed = computeAnchorHash({
      contentHash,
      prevAnchorHash: anchor.prevAnchorHash,
      sequence: anchor.sequence,
      timestampMs: anchor.createdAt.getTime(),
      tenantId: anchor.tenantId,
    });
    if (recomputed !== anchor.anchorHash) {
      return {
        valid: false,
        provider: 'local',
        reason:
          'contentHash no matchea con el anchor (documento alterado o anchor de otro doc)',
        details: { sequence: anchor.sequence, expected: anchor.anchorHash },
      };
    }

    // La firma se verifica contra el anchorHash guardado (no el
    // recalculado — son iguales acá pero la convención es "firma sobre
    // lo que guardé").
    const key = await this.db.tenantNotaryKey.findUnique({
      where: { tenantId: anchor.tenantId },
    });
    if (!key) {
      return {
        valid: false,
        provider: 'local',
        reason: 'tenant no tiene keypair registrada (estado inconsistente)',
        details: { sequence: anchor.sequence },
      };
    }
    // Asegurar que el anchor.signerKeyId apunta a la key activa del tenant.
    // Si alguien altera el signerKeyId sin re-firmar, la verify de la firma
    // matcheante igual lo detecta — pero acá rechazamos antes para que el
    // detalle de auditoría no quede inconsistente con la realidad on-record.
    if (anchor.signerKeyId !== key.fingerprint) {
      return {
        valid: false,
        provider: 'local',
        reason:
          'signer_key_mismatch (signerKeyId no coincide con la key activa del tenant)',
        details: {
          sequence: anchor.sequence,
          signerKeyId: anchor.signerKeyId,
          activeKeyFingerprint: key.fingerprint,
        },
      };
    }
    const sigOk = verifySignature(
      anchor.anchorHash,
      anchor.signature,
      key.publicKeyPem,
    );
    if (!sigOk) {
      return {
        valid: false,
        provider: 'local',
        reason: 'firma inválida (anchor o key alterados)',
        details: { sequence: anchor.sequence, signerKeyId: anchor.signerKeyId },
      };
    }

    return {
      valid: true,
      provider: 'local',
      details: {
        sequence: anchor.sequence,
        anchorHash: anchor.anchorHash,
        signerKeyId: anchor.signerKeyId,
        anchoredAt: anchor.createdAt,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helper interno — getOrCreateTenantKey.
  // -------------------------------------------------------------------------

  /**
   * Devuelve la `TenantNotaryKey` del tenant. Si no existe, genera un
   * keypair RSA-2048 nuevo, cifra la privada con la master key y la
   * persiste. Idempotente bajo concurrencia: el unique en `tenantId` de
   * `TenantNotaryKey` garantiza una sola key por tenant.
   *
   * En el sub-PR 2 esto NO maneja rotación de keys — siempre devuelve la
   * key activa (única). Cuando llegue rotación, lo extendemos para
   * filtrar por `deactivatedAt IS NULL`.
   */
  private async getOrCreateTenantKey(
    tenantId: string,
  ): Promise<TenantNotaryKeyRecord> {
    const existing = await this.db.tenantNotaryKey.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const kp = generateKeypair();
    const privateKeyEncrypted = encryptWithMasterKey(
      kp.privateKeyPem,
      this.masterKey,
    );
    return this.db.tenantNotaryKey.create({
      data: {
        tenantId,
        algorithm: kp.algorithm,
        publicKeyPem: kp.publicKeyPem,
        privateKeyEncrypted,
        fingerprint: kp.fingerprint,
      },
    });
  }
}
