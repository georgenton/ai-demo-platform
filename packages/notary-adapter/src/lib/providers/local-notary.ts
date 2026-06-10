// -----------------------------------------------------------------------------
// LocalNotaryAdapter — STUB. Implementación real viene en sub-PR 2.
//
// Cuando esté completo, va a:
//
//   1. Generar (al onboarding del tenant) un keypair RSA-PSS-2048,
//      guardar la pública en `TenantNotaryKey.publicKeyPem` y la privada
//      CIFRADA con NOTARY_MASTER_KEY en `privateKeyEncrypted`.
//   2. En cada `anchor()`:
//      a. Calcular sequence = max(sequence existente del tenant) + 1.
//      b. prevAnchorHash = anchorHash del anchor anterior del tenant
//         (o GENESIS_HASH si es el primero).
//      c. anchorHash = SHA-256(
//           contentHash || prevAnchorHash || sequence || createdAt || tenantId
//         )
//      d. signature = RSA-PSS-SHA256(anchorHash) con la clave privada del
//         tenant.
//      e. INSERT en LocalAnchor.
//   3. En cada `verify()`:
//      a. Buscar el LocalAnchor por anchorId (= anchorHash).
//      b. Recalcular anchorHash desde los campos guardados; comparar.
//      c. Verificar firma con la pública del tenant.
//      d. Devolver `valid: true|false` con razón si false.
// -----------------------------------------------------------------------------

import type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '../types.js';

/**
 * Dependencias del LocalNotaryAdapter.
 *
 * El sub-PR 2 va a definir bien el tipo del cliente Prisma y la master key
 * (string base64 32 bytes leída del env NOTARY_MASTER_KEY).
 */
export interface LocalNotaryDeps {
  /** Cliente Prisma para leer/escribir LocalAnchor y TenantNotaryKey. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  /**
   * Llave maestra de 32 bytes para cifrar las privateKey de los tenants en
   * reposo. En el sub-PR 2 se valida que tenga exactamente 32 bytes y se
   * deriva con HKDF para usos distintos (encrypt vs auth).
   */
  masterKey: string;
}

export class LocalNotaryAdapter implements NotaryAdapter {
  constructor(deps: LocalNotaryDeps) {
    // Stub — sub-PR 2 va a guardar `deps.db` y `deps.masterKey` como
    // campos privados y preparar los helpers de criptografía. Por ahora
    // solo aceptamos la firma para que el factory pueda instanciarnos
    // con las deps correctas; ignoramos el valor.
    void deps;
  }

  async anchor(req: AnchorRequest): Promise<AnchorResult> {
    void req;
    throw new Error(
      'LocalNotaryAdapter.anchor() no implementado en sub-PR 1. ' +
        'Llega en sub-PR 2 — ver ADR-0019, sección "Plan de implementación".',
    );
  }

  async verify(
    anchorId: string,
    contentHash: string,
  ): Promise<VerificationResult> {
    void anchorId;
    void contentHash;
    throw new Error(
      'LocalNotaryAdapter.verify() no implementado en sub-PR 1. ' +
        'Llega en sub-PR 2 — ver ADR-0019, sección "Plan de implementación".',
    );
  }
}
