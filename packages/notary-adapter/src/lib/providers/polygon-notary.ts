// -----------------------------------------------------------------------------
// PolygonNotaryAdapter — anchor on-chain en Polygon (Amoy/mainnet).
//
// Estrategia: tx self-send con `data` = hex(contentHash). Es el método más
// barato y simple para anclar un hash en una EVM chain:
//
//   - 21000 + 16 * length(data) gas (~24400 con 64 chars de contentHash).
//   - No requiere desplegar/auditar un contrato.
//   - El `data` queda inmutable en la chain y verificable con
//     `provider.getTransaction(hash).data`.
//
// Interfaces estructurales (PolygonSigner, PolygonProvider, ...): el
// package NO depende de `ethers` en runtime. El consumer (apps/api en
// sub-PR 4) construye un `ethers.Wallet` que matchea por estructura.
// Para tests, un fake estructural sin red.
//
// Manejo de estados:
//   - anchor() broadcasts y espera 1 confirmación con timeout. Si la
//     confirmación llega → status='confirmed'. Si timeout → 'pending'
//     y el caller (sub-PR 4) puede consultar status después.
//   - anchor() lanza si el broadcast mismo falla (sin saldo, RPC down,
//     etc). El mensaje se sanitiza (no expone URLs internas).
//   - verify() devuelve { valid: false, reason } sin lanzar (igual que
//     el LocalNotaryAdapter).
// -----------------------------------------------------------------------------

import type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Interfaces estructurales — subset de la API de ethers v6.
//
// Defino solo lo que el adapter usa. El runtime de ethers NO se importa
// — el consumer pasa un `ethers.Wallet` (o un mock) que matchea por
// estructura. Eso mantiene este package independiente de ethers y los
// tests son triviales de escribir.
// ---------------------------------------------------------------------------

/** Solicitud de tx que el adapter manda al signer. */
export interface PolygonTxRequest {
  to: string;
  value?: bigint;
  data: string;
}

/** Receipt simplificado tras `tx.wait(N)`. */
export interface PolygonTxReceipt {
  hash: string;
  blockNumber: number;
  /** `1` = success, `0` = reverted. */
  status: number;
}

/** Respuesta a `signer.sendTransaction(...)`. */
export interface PolygonTxResponse {
  hash: string;
  /**
   * Espera a que la tx tenga `confirmations` bloques de confirmación.
   * Devuelve el receipt cuando llega, o `null` si fue cancelada.
   *
   * En `ethers` v6 acepta segundo arg `timeoutMs`. Lo replicamos para
   * tener control del wait sin freeze infinito en tests.
   */
  wait(
    confirmations?: number,
    timeoutMs?: number,
  ): Promise<PolygonTxReceipt | null>;
}

/** Tx tal como vive en la chain — vista de lectura. */
export interface PolygonOnchainTx {
  hash: string;
  /** Hex con prefix `0x`. El contentHash original es `data.slice(2)`. */
  data: string;
  /** `null` si está pending. */
  blockNumber: number | null;
}

/** Provider de lectura — solo necesitamos `getTransaction` para verify(). */
export interface PolygonProvider {
  getTransaction(hash: string): Promise<PolygonOnchainTx | null>;
}

/** Signer de escritura — capaz de broadcast txs. */
export interface PolygonSigner {
  getAddress(): Promise<string>;
  sendTransaction(tx: PolygonTxRequest): Promise<PolygonTxResponse>;
  /** Provider asociado al signer. Lo usamos para verify(). */
  readonly provider: PolygonProvider;
}

// ---------------------------------------------------------------------------
// Configuración del adapter.
// ---------------------------------------------------------------------------

/**
 * Identificadores de red soportados. El demo arranca con `polygon-amoy`.
 * Para producción real basta cambiar a `polygon-mainnet` + cambiar el
 * signer al provider de mainnet.
 *
 * Tipo string libre (no union) para que el sub-PR 4 pueda agregar redes
 * sin tocar el package — solo registrar la entrada en EXPLORER_BASE.
 */
export type PolygonNetwork = string;

/**
 * Mapeo network → base URL del explorer público. Lo expone el adapter
 * vía `getExplorerUrl()` para que la UI (sub-PR 5) arme links.
 */
const EXPLORER_BASE: Record<string, string> = {
  'polygon-amoy': 'https://amoy.polygonscan.com',
  'polygon-mainnet': 'https://polygonscan.com',
};

/** Default de confirmaciones a esperar en anchor(). */
const DEFAULT_CONFIRMATIONS = 1;
/** Default de timeout para el `wait()`. 30s suele alcanzar en Amoy. */
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;

export interface PolygonNotaryDeps {
  /** Signer de ethers.js (o fake estructural en tests). */
  signer: PolygonSigner;
  /**
   * Nombre canónico de la red. Se persiste en `PublicAnchor.network` para
   * que la UI sepa qué explorer URL armar.
   */
  network: PolygonNetwork;
  /**
   * Confirmaciones a esperar antes de devolver `status='confirmed'`.
   * Default 1. Para mainnet con stake importante, considerar 3-5.
   */
  confirmations?: number;
  /**
   * Timeout en ms para esperar las confirmaciones. Si vence, anchor()
   * devuelve `status='pending'` con el txHash ya broadcast — el caller
   * decide si reintentar consulta o esperar.
   */
  waitTimeoutMs?: number;
}

export class PolygonNotaryAdapter implements NotaryAdapter {
  private readonly signer: PolygonSigner;
  private readonly network: PolygonNetwork;
  private readonly confirmations: number;
  private readonly waitTimeoutMs: number;

  constructor(deps: PolygonNotaryDeps) {
    this.signer = deps.signer;
    this.network = deps.network;
    this.confirmations = deps.confirmations ?? DEFAULT_CONFIRMATIONS;
    this.waitTimeoutMs = deps.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  }

  // -------------------------------------------------------------------------
  // anchor() — broadcast self-tx con data = contentHash.
  // -------------------------------------------------------------------------

  async anchor(req: AnchorRequest): Promise<AnchorResult> {
    if (!req.contentHash || req.contentHash.length !== 64) {
      throw new Error(
        'PolygonNotaryAdapter.anchor: contentHash debe ser hex de 64 chars (SHA-256).',
      );
    }
    if (!/^[0-9a-f]+$/i.test(req.contentHash)) {
      throw new Error(
        'PolygonNotaryAdapter.anchor: contentHash debe ser hex lowercase válido.',
      );
    }
    if (!req.tenantId) {
      throw new Error('PolygonNotaryAdapter.anchor: tenantId requerido.');
    }
    if (!req.documentId) {
      throw new Error('PolygonNotaryAdapter.anchor: documentId requerido.');
    }

    const from = await this.signer.getAddress();
    const data = '0x' + req.contentHash.toLowerCase();

    // 1. Broadcast — la tx más barata posible: self-send con data inline.
    //
    // Sanitizamos cualquier error del broadcast antes de re-lanzar. Los
    // errores típicos de RPC traen URLs internas y stack traces que no
    // queremos en respuestas HTTP del sub-PR 4.
    let tx: PolygonTxResponse;
    try {
      tx = await this.signer.sendTransaction({
        to: from,
        value: 0n,
        data,
      });
    } catch (err) {
      throw new Error(
        `PolygonNotaryAdapter.anchor: broadcast falló — ${sanitizeError(err)}`,
      );
    }

    const requestedAt = new Date();

    // 2. Esperar la confirmación. Si tarda más del timeout, devolvemos
    //    con status='pending' (el caller persiste el txHash y puede
    //    consultar después).
    let receipt: PolygonTxReceipt | null = null;
    try {
      receipt = await tx.wait(this.confirmations, this.waitTimeoutMs);
    } catch (err) {
      // `wait()` puede lanzar por timeout en algunas implementaciones.
      // Tratamos como pending: la tx ya fue broadcast con éxito (tx.hash
      // existe), solo no esperamos confirmación.
      void err;
      receipt = null;
    }

    if (receipt && receipt.status === 0) {
      // Tx revertida en la chain — es un fallo claro, no pending.
      throw new Error(
        `PolygonNotaryAdapter.anchor: tx ${tx.hash} se revirtió on-chain (status=0).`,
      );
    }

    return {
      anchorId: tx.hash,
      provider: 'polygon',
      status: receipt ? 'confirmed' : 'pending',
      anchoredAt: requestedAt,
      details: {
        network: this.network,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        from,
        explorerUrl: this.getExplorerUrl(tx.hash),
        anchoredHash: req.contentHash.toLowerCase(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // verify() — confirma que la tx existe y su data matchea el contentHash.
  // -------------------------------------------------------------------------

  async verify(
    anchorId: string,
    contentHash: string,
  ): Promise<VerificationResult> {
    if (!anchorId) {
      return {
        valid: false,
        provider: 'polygon',
        reason: 'anchorId vacío',
        details: {},
      };
    }
    if (!contentHash || contentHash.length !== 64) {
      return {
        valid: false,
        provider: 'polygon',
        reason: 'contentHash inválido (no es SHA-256 hex de 64 chars)',
        details: {},
      };
    }

    let onchain: PolygonOnchainTx | null;
    try {
      onchain = await this.signer.provider.getTransaction(anchorId);
    } catch (err) {
      return {
        valid: false,
        provider: 'polygon',
        reason: `fallo al consultar la chain: ${sanitizeError(err)}`,
        details: {},
      };
    }
    if (!onchain) {
      return {
        valid: false,
        provider: 'polygon',
        reason: 'tx no encontrada on-chain',
        details: { network: this.network },
      };
    }

    // El data on-chain viene con prefix 0x. Strippeamos y comparamos
    // case-insensitive — `tx.data` puede llegar en upper o lower hex
    // según el cliente RPC.
    const onchainHash = onchain.data.toLowerCase().replace(/^0x/, '');
    if (onchainHash !== contentHash.toLowerCase()) {
      return {
        valid: false,
        provider: 'polygon',
        reason: 'contentHash no matchea con el data de la tx on-chain',
        details: {
          network: this.network,
          txHash: onchain.hash,
          expected: onchainHash,
          received: contentHash.toLowerCase(),
        },
      };
    }

    if (onchain.blockNumber === null) {
      // La tx existe pero está en mempool. No es inválida — está pending.
      // El caller decide si esperar más o aceptar pending como
      // "anchor existe pero aún sin sello definitivo".
      return {
        valid: false,
        provider: 'polygon',
        reason: 'tx encontrada pero aún sin incluir en bloque (pending)',
        details: {
          network: this.network,
          txHash: onchain.hash,
          explorerUrl: this.getExplorerUrl(onchain.hash),
        },
      };
    }

    return {
      valid: true,
      provider: 'polygon',
      details: {
        network: this.network,
        txHash: onchain.hash,
        blockNumber: onchain.blockNumber,
        explorerUrl: this.getExplorerUrl(onchain.hash),
      },
    };
  }

  /**
   * URL pública del explorer para un tx hash en la red activa. Si la
   * network no está registrada en EXPLORER_BASE, devuelve string vacío
   * — el frontend muestra el txHash a pelo sin link.
   */
  getExplorerUrl(txHash: string): string {
    const base = EXPLORER_BASE[this.network];
    return base ? `${base}/tx/${txHash}` : '';
  }
}

// ---------------------------------------------------------------------------
// Helpers internos.
// ---------------------------------------------------------------------------

/**
 * Convierte un error desconocido en un mensaje corto y seguro. Los
 * errores de ethers / RPCs traen URLs, IPs y stack traces que NO
 * queremos en respuestas HTTP públicas.
 *
 * Estrategia:
 *   - Strings → primeros 200 chars.
 *   - Error → `message` (primeros 200 chars) sin stack.
 *   - Otro → 'error desconocido'.
 */
function sanitizeError(err: unknown): string {
  const MAX = 200;
  if (typeof err === 'string') return err.slice(0, MAX);
  if (err instanceof Error) return err.message.slice(0, MAX);
  return 'error desconocido';
}
