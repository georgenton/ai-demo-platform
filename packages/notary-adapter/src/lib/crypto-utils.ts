// -----------------------------------------------------------------------------
// Helpers de criptografía para el LocalNotaryAdapter (ADR-0019).
//
// Tres bloques:
//
//   1. **Cifrado simétrico** (AES-256-GCM) para almacenar la clave privada
//      RSA del tenant cifrada en `TenantNotaryKey.privateKeyEncrypted`. La
//      key maestra (NOTARY_MASTER_KEY del env) cifra y descifra.
//
//   2. **Keypair RSA-PSS-2048** para firmar los `anchorHash`. Generación,
//      export PEM, firma, verificación. La privada del tenant queda cifrada
//      en reposo; la pública se guarda en plano (no es secreta — sirve
//      para que terceros verifiquen).
//
//   3. **Hashing** — wrapper de SHA-256 hex usado en el cálculo del
//      anchorHash y del fingerprint de la pública.
//
// Todo va contra el módulo `node:crypto` estándar — cero deps externas.
//
// Para fundamentos y trade-offs ver ADR-0019, sección "Negativas / costos".
// -----------------------------------------------------------------------------

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
  constants as cryptoConstants,
} from 'node:crypto';

// ---------------------------------------------------------------------------
// Constantes — visibles para los tests.
// ---------------------------------------------------------------------------

/** Algoritmo simétrico para cifrar la privada del tenant. */
export const SYMMETRIC_ALGORITHM = 'aes-256-gcm';
/** Bytes del IV de GCM (12 es el tamaño recomendado por NIST SP 800-38D). */
const IV_BYTES = 12;
/** Bytes del auth tag de GCM. */
const TAG_BYTES = 16;
/** Bytes esperados de la master key (256 bits). */
export const MASTER_KEY_BYTES = 32;

/** Algoritmo asimétrico que el adapter usa. */
export const ASYMMETRIC_ALGORITHM = 'RSA-PSS-SHA256-2048';
const RSA_MODULUS_LENGTH = 2048;
/** Hash subyacente para la firma RSA-PSS. */
const SIGN_HASH = 'sha256';
/** Salt length en bytes de la firma RSA-PSS (matching SHA-256). */
const PSS_SALT_LENGTH = 32;

// ---------------------------------------------------------------------------
// (1) Cifrado simétrico — AES-256-GCM.
// ---------------------------------------------------------------------------

/**
 * Valida que `masterKey` tenga la longitud correcta para AES-256.
 *
 * El formato esperado es **hex de 64 chars** (= 32 bytes = 256 bits). Es la
 * convención que vamos a documentar en el ADR-0019: el operador genera con
 * `openssl rand -hex 32` y la pone como env var `NOTARY_MASTER_KEY`.
 *
 * Lanza con mensaje claro si la longitud no es la esperada.
 */
export function parseMasterKey(masterKey: string): Buffer {
  const buf = Buffer.from(masterKey, 'hex');
  if (buf.length !== MASTER_KEY_BYTES) {
    throw new Error(
      `NOTARY_MASTER_KEY debe ser hex de ${MASTER_KEY_BYTES * 2} chars ` +
        `(= ${MASTER_KEY_BYTES} bytes). Recibido: ${buf.length} bytes.`,
    );
  }
  return buf;
}

/**
 * Cifra un payload con AES-256-GCM y devuelve un blob base64 con el shape:
 *
 *   base64( iv (12B) || authTag (16B) || ciphertext )
 *
 * El IV es random fresh por cada llamada — fundamental para GCM (reusar
 * IV con misma key rompe la seguridad por completo).
 *
 * Decodificar con `decryptWithMasterKey`.
 */
export function encryptWithMasterKey(
  plaintext: string,
  masterKey: Buffer,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(SYMMETRIC_ALGORITHM, masterKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Descifra un blob producido por `encryptWithMasterKey`. Lanza si el blob
 * está alterado (GCM detecta tampering vía el auth tag) o si la key no
 * coincide con la usada al cifrar.
 */
export function decryptWithMasterKey(blob: string, masterKey: Buffer): string {
  const raw = Buffer.from(blob, 'base64');
  if (raw.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error(
      `decryptWithMasterKey: blob demasiado corto (${raw.length} bytes).`,
    );
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(SYMMETRIC_ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}

// ---------------------------------------------------------------------------
// (2) Keypair asimétrico — RSA-PSS-2048.
// ---------------------------------------------------------------------------

export interface GeneratedKeypair {
  /** PEM de la clave pública (formato SPKI). Apto para verificar firmas. */
  publicKeyPem: string;
  /** PEM de la clave privada (PKCS#8). NUNCA mostrar al cliente sin cifrar. */
  privateKeyPem: string;
  /** Fingerprint corto (16 hex chars del SHA-256 del publicKeyPem). */
  fingerprint: string;
  /** Algoritmo legible — `ASYMMETRIC_ALGORITHM`. Útil para auditoría. */
  algorithm: typeof ASYMMETRIC_ALGORITHM;
}

/**
 * Genera un keypair RSA-2048 nuevo. La operación es ~50–200ms en CPU
 * moderna, así que no es algo a hacer en cada request — el adapter solo
 * genera UNA vez por tenant al onboarding (`getOrCreateTenantKey`).
 */
export function generateKeypair(): GeneratedKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    fingerprint: fingerprintOfPublicKey(publicKey),
    algorithm: ASYMMETRIC_ALGORITHM,
  };
}

/**
 * Fingerprint corto de una clave pública: primeros 16 chars del SHA-256
 * hex del PEM. Sirve como `signerKeyId` en `LocalAnchor` para distinguir
 * qué clave firmó (relevante cuando rotamos claves en el futuro).
 */
export function fingerprintOfPublicKey(publicKeyPem: string): string {
  return createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
}

/**
 * Firma `data` con la clave privada usando RSA-PSS-SHA256. El resultado
 * es base64 — el formato persistible más compacto que después se puede
 * pasar a `verifySignature` sin transformación.
 */
export function signWithPrivateKey(
  data: string,
  privateKeyPem: string,
): string {
  const signature = cryptoSign(SIGN_HASH, Buffer.from(data, 'utf8'), {
    key: privateKeyPem,
    padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
    saltLength: PSS_SALT_LENGTH,
  });
  return signature.toString('base64');
}

/**
 * Verifica una firma producida por `signWithPrivateKey`. Devuelve
 * `true` si y solo si:
 *   - La firma es base64 válido.
 *   - La firma matchea `data` bajo la pública dada.
 *
 * Nunca lanza por firma inválida — devuelve `false`. Lanza solo por
 * input groseramente mal formado (PEM corrupto, etc).
 */
export function verifySignature(
  data: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const sigBuf = Buffer.from(signatureBase64, 'base64');
    return cryptoVerify(
      SIGN_HASH,
      Buffer.from(data, 'utf8'),
      {
        key: publicKeyPem,
        padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
        saltLength: PSS_SALT_LENGTH,
      },
      sigBuf,
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// (3) Hashing — wrapper de SHA-256 para usos del adapter.
// ---------------------------------------------------------------------------

/**
 * SHA-256 hex de un string UTF-8. 64 chars lowercase. Usado para calcular
 * el `anchorHash` y el `GENESIS_HASH`.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Hash de "génesis" del tenant — `prevAnchorHash` del primer anchor de
 * cada tenant. Valor constante conocido: SHA-256("notary-genesis-v1").
 *
 * El sufijo `-v1` permite cambiar el genesis en el futuro (forzando un
 * "fork" del ledger del tenant). Sub-PR 2 lo mantiene como constante;
 * cuando llegue rotación de keys o reset de ledger, se puede subir a v2
 * y migrar los anchors viejos a un namespace antiguo.
 */
export const GENESIS_PREV_HASH: string = sha256Hex('notary-genesis-v1');

/**
 * Calcula el `anchorHash` canónico para un anchor.
 *
 *   anchorHash = SHA-256(
 *     contentHash || ":" ||
 *     prevAnchorHash || ":" ||
 *     sequence || ":" ||
 *     timestampMs || ":" ||
 *     tenantId
 *   )
 *
 * Los `:` separadores evitan ambigüedad (`"a" + "b"` vs `"ab" + ""`). El
 * orden es importante — verificar lo recalcula exactamente igual.
 *
 * `timestampMs` es el `Date.now()` del momento del anchor — entra al hash
 * para que el mismo contentHash repetido produzca anchors distintos. El
 * caller persiste este timestamp en `LocalAnchor.createdAt`.
 */
export function computeAnchorHash(params: {
  contentHash: string;
  prevAnchorHash: string;
  sequence: number;
  timestampMs: number;
  tenantId: string;
}): string {
  const payload = [
    params.contentHash,
    params.prevAnchorHash,
    String(params.sequence),
    String(params.timestampMs),
    params.tenantId,
  ].join(':');
  return sha256Hex(payload);
}
