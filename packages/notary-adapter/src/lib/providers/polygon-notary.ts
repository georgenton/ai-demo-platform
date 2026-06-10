// -----------------------------------------------------------------------------
// PolygonNotaryAdapter — STUB. Implementación real viene en sub-PR 3.
//
// Cuando esté completo, va a:
//
//   1. Recibir un `signer` de ethers.js (Wallet conectada a un Provider
//      apuntando a Polygon Mumbai por default; mainnet en producción).
//   2. En cada `anchor()`:
//      a. Construir una tx simple con `data = "0x" + contentHash` (sin
//         contrato — solo "0x68 bytes de data"). Es la forma más barata
//         de anclar un hash on-chain.
//      b. Broadcast la tx, esperar 1 bloque para confirmación tentativa.
//      c. Devolver { anchorId: txHash, status: 'pending', details:
//         { network, txHash, blockNumber } }.
//      d. Un job posterior puede esperar a `confirmedAt` (5 bloques)
//         y promover a `confirmed` — eso lo decide el service.
//   3. En cada `verify()`:
//      a. Buscar la tx por hash en la chain.
//      b. Confirmar que tiene >= N bloques de confirmación.
//      c. Confirmar que el `data` de la tx matchea el contentHash.
//      d. Devolver `valid: true|false`.
//
// Por qué tx simple y no smart contract:
//   - Más barato (~21k gas vs ~50k+ con contrato).
//   - Más simple — no requiere desplegar/auditar un contrato.
//   - Suficiente para anchor de hashes; si en el futuro queremos
//     metadata estructurada on-chain (categoría, timestamp firmado),
//     se agrega un contrato sin tocar la interfaz `NotaryAdapter`.
// -----------------------------------------------------------------------------

import type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '../types.js';

/**
 * Dependencias del PolygonNotaryAdapter.
 *
 * El sub-PR 3 tipa esto bien con `ethers.Wallet | ethers.Signer` y un
 * union de redes soportadas ('polygon-mumbai' | 'polygon-mainnet').
 */
export interface PolygonNotaryDeps {
  /** Signer de ethers.js conectado a la red destino. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any;
  /**
   * Nombre de la red — 'polygon-mumbai' o 'polygon-mainnet'. Se persiste
   * en `PublicAnchor.network` para que el frontend sepa a qué explorer
   * apuntar el link.
   */
  network: string;
}

export class PolygonNotaryAdapter implements NotaryAdapter {
  constructor(deps: PolygonNotaryDeps) {
    // Stub — sub-PR 3 va a guardar `deps.signer` + `deps.network` como
    // campos privados y validar conectividad a la red. Por ahora solo
    // aceptamos la firma para que el factory pueda instanciarnos.
    void deps;
  }

  async anchor(req: AnchorRequest): Promise<AnchorResult> {
    void req;
    throw new Error(
      'PolygonNotaryAdapter.anchor() no implementado en sub-PR 1. ' +
        'Llega en sub-PR 3 — ver ADR-0019, sección "Plan de implementación".',
    );
  }

  async verify(
    anchorId: string,
    contentHash: string,
  ): Promise<VerificationResult> {
    void anchorId;
    void contentHash;
    throw new Error(
      'PolygonNotaryAdapter.verify() no implementado en sub-PR 1. ' +
        'Llega en sub-PR 3 — ver ADR-0019, sección "Plan de implementación".',
    );
  }
}
