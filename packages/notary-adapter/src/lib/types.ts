// -----------------------------------------------------------------------------
// Tipos del NotaryAdapter (ADR-0019).
//
// Dos roles, una sola interfaz:
//   - "Notarizer local" (mini-ledger en Postgres firmado con clave RSA).
//   - "Notarizer público" (anchor on-chain en Polygon Mumbai/mainnet).
//
// Ambos implementan la misma interfaz `NotaryAdapter` para que el caller
// (NotarizationService en sub-PR 4) pueda invocar a uno, al otro, o a los
// dos según el modo elegido por el usuario — sin if/else por provider.
// -----------------------------------------------------------------------------

/**
 * Proveedores soportados de notarización.
 *
 *   - `local`: mini-ledger interno firmado (LocalNotaryAdapter).
 *   - `polygon`: anchor on-chain en Polygon Mumbai o mainnet
 *     (PolygonNotaryAdapter).
 *   - `fake`: implementación determinística para CI y tests sin red ni keys.
 *
 * Si en el futuro agregamos Fabric, Avalanche, Solana, etc, se suman acá y
 * se implementa un nuevo provider. El resto del sistema se entera por
 * tipos.
 */
export type NotaryProvider = 'local' | 'polygon' | 'fake';

/**
 * Configuración base. Cada provider concreto extiende este tipo con sus
 * campos específicos (ver providers/*-notary.ts).
 */
export interface NotaryConfig {
  provider: NotaryProvider;
}

/**
 * Input para crear un anchor. Lo que efectivamente queda "sellado" es el
 * `contentHash` (SHA-256 hex del binario del PDF original) — nunca el PDF
 * completo.
 *
 * El tenantId viaja con el request por multi-tenant (ADR-0013): el
 * LocalNotaryAdapter usa el ledger del tenant; el PolygonNotaryAdapter
 * lo guarda en metadata pero no afecta la tx on-chain (el hash es lo
 * único que va a la chain).
 */
export interface AnchorRequest {
  /** SHA-256 hex (64 chars lowercase) del binario del PDF original. */
  contentHash: string;
  /** Tenant que pide la notarización (ADR-0013). */
  tenantId: string;
  /** ID del documento — para guardar la relación en la tabla del provider. */
  documentId: string;
  /**
   * Metadata libre para el adapter. Hoy no se usa; queda como hook para
   * futuro (ej. tipo de documento, ID del usuario que firma).
   */
  metadata?: Record<string, string>;
}

/**
 * Resultado del anchor — la "prueba" que el adapter genera.
 *
 * El shape es genérico para que el caller pueda guardarlo sin conocer al
 * provider. Los campos específicos del provider viven en `details`.
 */
export interface AnchorResult {
  /** ID único del anchor en el sistema del provider (anchorHash local o txHash on-chain). */
  anchorId: string;
  /** Provider que generó el anchor — para que el caller sepa cómo verificar. */
  provider: NotaryProvider;
  /**
   * Estado actual del anchor:
   *   - 'confirmed': el anchor existe y es verificable.
   *   - 'pending':   broadcast pero esperando confirmación (típico Polygon
   *                  durante los primeros segundos).
   *
   * `failed` no se devuelve acá — un anchor que falla lanza una excepción
   * desde `anchor()`. Si el provider quiere registrar el intento fallido
   * en su BD, eso es responsabilidad del provider.
   */
  status: 'confirmed' | 'pending';
  /**
   * Timestamp del momento en que se aceptó el anchor. Es el `createdAt`
   * del LocalAnchor o el `requestedAt` del PublicAnchor — el adapter
   * decide.
   */
  anchoredAt: Date;
  /**
   * Detalles específicos del provider. Para local: { sequence,
   * prevAnchorHash, signature, signerKeyId }. Para polygon: { network,
   * txHash, blockNumber, contractAddress }. El caller los persiste sin
   * inspeccionarlos.
   */
  details: Record<string, unknown>;
}

/**
 * Resultado de verificar un anchor existente. Útil para el endpoint
 * "validar este documento contra su anchor" (sub-PR 4).
 */
export interface VerificationResult {
  /** True si el anchor existe y matchea el contentHash provisto. */
  valid: boolean;
  /** Provider del anchor que se verificó. */
  provider: NotaryProvider;
  /**
   * Razón humana cuando `valid=false` (ej. "anchor no encontrado",
   * "firma inválida", "tx no confirmada"). Null cuando `valid=true`.
   */
  reason?: string;
  /**
   * Información adicional del anchor verificado. Para local: incluye la
   * cadena de hashes hasta el anchor. Para polygon: incluye el bloque y
   * link al explorer. El caller decide qué mostrar al usuario.
   */
  details: Record<string, unknown>;
}

/**
 * Contrato de un proveedor de notarización. Dos métodos:
 *
 *   - `anchor`: genera un nuevo anchor para un contentHash. Llamado por
 *     NotarizationService cuando un usuario sube un PDF y elige
 *     notarizarlo (sub-PR 4).
 *   - `verify`: verifica que un anchor existente sigue siendo válido (en
 *     local: cadena íntegra + firma OK; en polygon: tx confirmada y hash
 *     en la chain matchea). Llamado por el endpoint de verificación.
 *
 * Tres reglas importantes:
 *
 *   1. `anchor()` NO debe ser idempotente automáticamente. Cada llamada
 *      genera un anchor nuevo. La deduplicación (si la queremos) vive en
 *      la capa de servicio, no en el adapter — algunos casos legales
 *      necesitan re-anchor (ej. mismo PDF, distinta red).
 *
 *   2. `anchor()` lanza excepción si falla (sin saldo, sin red, ledger
 *      corrupto). El service captura y devuelve 5xx al cliente.
 *
 *   3. `verify()` NUNCA lanza por "anchor inválido" — devuelve
 *      `{ valid: false, reason }`. Lanza solo por errores
 *      inesperados (BD caída, red caída).
 */
export interface NotaryAdapter {
  anchor(req: AnchorRequest): Promise<AnchorResult>;
  verify(anchorId: string, contentHash: string): Promise<VerificationResult>;
}
