// -----------------------------------------------------------------------------
// Tests de los helpers de crypto-utils. Cubren los tres bloques:
//   1. Cifrado simétrico (encrypt/decrypt roundtrip + tampering detection).
//   2. Keypair RSA + sign/verify roundtrip + cross-key rejection.
//   3. Hashing + cálculo de anchorHash (determinismo + sensibilidad a inputs).
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  ASYMMETRIC_ALGORITHM,
  computeAnchorHash,
  decryptWithMasterKey,
  encryptWithMasterKey,
  fingerprintOfPublicKey,
  generateKeypair,
  GENESIS_PREV_HASH,
  MASTER_KEY_BYTES,
  parseMasterKey,
  sha256Hex,
  signWithPrivateKey,
  verifySignature,
} from './crypto-utils.js';

const VALID_MASTER_KEY_HEX = 'a'.repeat(MASTER_KEY_BYTES * 2);

describe('parseMasterKey', () => {
  it('acepta hex de 64 chars (32 bytes)', () => {
    const buf = parseMasterKey(VALID_MASTER_KEY_HEX);
    expect(buf.length).toBe(MASTER_KEY_BYTES);
  });

  it('rechaza key demasiado corta con mensaje claro', () => {
    expect(() => parseMasterKey('a'.repeat(10))).toThrow(/64 chars/);
  });

  it('rechaza key demasiado larga', () => {
    expect(() => parseMasterKey('a'.repeat(100))).toThrow(/64 chars/);
  });
});

describe('AES-256-GCM (encryptWithMasterKey / decryptWithMasterKey)', () => {
  const key = parseMasterKey(VALID_MASTER_KEY_HEX);

  it('roundtrip preserva el plaintext exacto', () => {
    const plaintext = 'esto es un secreto cooperativo 🔒';
    const blob = encryptWithMasterKey(plaintext, key);
    expect(decryptWithMasterKey(blob, key)).toBe(plaintext);
  });

  it('cifrar dos veces el MISMO plaintext da blobs distintos (IV random)', () => {
    const blob1 = encryptWithMasterKey('hola', key);
    const blob2 = encryptWithMasterKey('hola', key);
    expect(blob1).not.toBe(blob2);
  });

  it('descifrar con master key distinta lanza', () => {
    const blob = encryptWithMasterKey('hola', key);
    const otherKey = parseMasterKey('b'.repeat(64));
    expect(() => decryptWithMasterKey(blob, otherKey)).toThrow();
  });

  it('descifrar un blob alterado lanza (auth tag detecta tampering)', () => {
    const blob = encryptWithMasterKey('hola', key);
    // Cambia 1 char del medio del base64 — lo bastante para alterar el
    // ciphertext sin destruir el shape del blob.
    const idx = Math.floor(blob.length / 2);
    const tampered =
      blob.slice(0, idx) +
      (blob[idx] === 'a' ? 'b' : 'a') +
      blob.slice(idx + 1);
    expect(() => decryptWithMasterKey(tampered, key)).toThrow();
  });

  it('descifrar un blob trivialmente corto lanza con mensaje claro', () => {
    expect(() => decryptWithMasterKey('AAAA', key)).toThrow(/corto/);
  });
});

describe('Keypair RSA + sign/verify', () => {
  it('generateKeypair devuelve PEMs válidos + fingerprint + algorithm', () => {
    const kp = generateKeypair();
    expect(kp.publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(kp.privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(kp.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(kp.algorithm).toBe(ASYMMETRIC_ALGORITHM);
  });

  it('dos keypairs generados tienen fingerprints distintos', () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('fingerprintOfPublicKey es determinístico', () => {
    const kp = generateKeypair();
    const f1 = fingerprintOfPublicKey(kp.publicKeyPem);
    const f2 = fingerprintOfPublicKey(kp.publicKeyPem);
    expect(f1).toBe(f2);
    expect(f1).toBe(kp.fingerprint);
  });

  it('sign + verify roundtrip OK', () => {
    const kp = generateKeypair();
    const data = 'anchor hash de prueba';
    const sig = signWithPrivateKey(data, kp.privateKeyPem);
    expect(verifySignature(data, sig, kp.publicKeyPem)).toBe(true);
  });

  it('verify rechaza si el data fue alterado', () => {
    const kp = generateKeypair();
    const sig = signWithPrivateKey('original', kp.privateKeyPem);
    expect(verifySignature('alterado', sig, kp.publicKeyPem)).toBe(false);
  });

  it('verify rechaza si la firma fue cifrada con OTRA clave (cross-key)', () => {
    const kpA = generateKeypair();
    const kpB = generateKeypair();
    const sig = signWithPrivateKey('hola', kpA.privateKeyPem);
    expect(verifySignature('hola', sig, kpB.publicKeyPem)).toBe(false);
  });

  it('verify devuelve false (no lanza) cuando la firma no es base64 válido', () => {
    const kp = generateKeypair();
    expect(verifySignature('hola', '!!!no-base64!!!', kp.publicKeyPem)).toBe(
      false,
    );
  });

  it('cada firma del mismo data es distinta (RSA-PSS es probabilístico)', () => {
    const kp = generateKeypair();
    const s1 = signWithPrivateKey('hola', kp.privateKeyPem);
    const s2 = signWithPrivateKey('hola', kp.privateKeyPem);
    // PSS suma salt random — firmas distintas, ambas válidas.
    expect(s1).not.toBe(s2);
    expect(verifySignature('hola', s1, kp.publicKeyPem)).toBe(true);
    expect(verifySignature('hola', s2, kp.publicKeyPem)).toBe(true);
  });
});

describe('sha256Hex + computeAnchorHash + GENESIS_PREV_HASH', () => {
  it('sha256Hex devuelve hex de 64 chars lowercase', () => {
    const h = sha256Hex('hola');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('GENESIS_PREV_HASH es estable y matchea SHA-256("notary-genesis-v1")', () => {
    expect(GENESIS_PREV_HASH).toBe(sha256Hex('notary-genesis-v1'));
    expect(GENESIS_PREV_HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  const baseParams = {
    contentHash: sha256Hex('pdf cualquiera'),
    prevAnchorHash: GENESIS_PREV_HASH,
    sequence: 0,
    timestampMs: 1_700_000_000_000,
    tenantId: 'tenant-utpl',
  };

  it('computeAnchorHash es determinístico', () => {
    expect(computeAnchorHash(baseParams)).toBe(computeAnchorHash(baseParams));
  });

  it('cambiar contentHash cambia el anchorHash', () => {
    const altered = {
      ...baseParams,
      contentHash: sha256Hex('pdf modificado'),
    };
    expect(computeAnchorHash(altered)).not.toBe(computeAnchorHash(baseParams));
  });

  it('cambiar tenantId cambia el anchorHash (aislamiento multi-tenant)', () => {
    const otherTenant = { ...baseParams, tenantId: 'tenant-jep' };
    expect(computeAnchorHash(otherTenant)).not.toBe(
      computeAnchorHash(baseParams),
    );
  });

  it('cambiar sequence cambia el anchorHash', () => {
    const next = { ...baseParams, sequence: 1 };
    expect(computeAnchorHash(next)).not.toBe(computeAnchorHash(baseParams));
  });

  it('cambiar timestamp cambia el anchorHash', () => {
    const later = { ...baseParams, timestampMs: baseParams.timestampMs + 1 };
    expect(computeAnchorHash(later)).not.toBe(computeAnchorHash(baseParams));
  });
});
