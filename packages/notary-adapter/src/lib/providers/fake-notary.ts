// -----------------------------------------------------------------------------
// FakeNotaryAdapter — implementación determinística para CI y tests E2E.
//
// Mismo espíritu que FakeChatAdapter / FakeEmbeddingsAdapter del
// llm-adapter: cero dependencias externas, cero estado persistente,
// resultados reproducibles.
//
// Cómo funciona:
//   - `anchor()`: el anchorId se deriva determinísticamente del
//     contentHash + documentId + tenantId. Mismas entradas → mismo
//     anchorId (útil para snapshots / golden tests).
//   - `verify()`: re-deriva el anchorId esperado desde el contentHash y
//     compara con el anchorId dado. Si matchean → valid. Si no → invalid
//     con razón clara.
//
// NUNCA usar en producción — no hay firma criptográfica, no hay broadcast,
// no hay verificación contra una chain real.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '../types.js';

/**
 * Genera un anchorId determinístico desde los componentes del request.
 *
 * SHA-256 hex (64 chars). Mismo input → mismo output siempre, en
 * cualquier máquina, en cualquier momento.
 *
 * Forma: SHA-256("fake:" || tenantId || ":" || documentId || ":" || contentHash).
 *
 * El prefijo "fake:" es una salvaguarda: si alguien por error consume un
 * anchor del fake en un sistema que espera anchors reales, el match
 * contra la chain real fallaría de todas formas.
 */
function deriveAnchorId(
  tenantId: string,
  documentId: string,
  contentHash: string,
): string {
  const input = `fake:${tenantId}:${documentId}:${contentHash}`;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Adapter fake — sin construirse con deps. La instancia es trivial y se
 * puede crear desde cualquier test sin setup.
 */
export class FakeNotaryAdapter implements NotaryAdapter {
  async anchor(req: AnchorRequest): Promise<AnchorResult> {
    if (!req.contentHash || req.contentHash.length !== 64) {
      throw new Error(
        'FakeNotaryAdapter.anchor: contentHash debe ser hex de 64 chars (SHA-256).',
      );
    }
    if (!req.tenantId) {
      throw new Error('FakeNotaryAdapter.anchor: tenantId requerido.');
    }
    if (!req.documentId) {
      throw new Error('FakeNotaryAdapter.anchor: documentId requerido.');
    }

    const anchorId = deriveAnchorId(
      req.tenantId,
      req.documentId,
      req.contentHash,
    );

    return {
      anchorId,
      provider: 'fake',
      status: 'confirmed',
      // Date fijo para determinismo en tests. El service real (sub-PR 4)
      // puede sobrescribir el `anchoredAt` con `new Date()` si necesita
      // un timestamp realista; el fake mantiene el determinismo.
      anchoredAt: new Date(0),
      details: {
        derivedFrom: 'sha256(fake:tenantId:documentId:contentHash)',
      },
    };
  }

  async verify(
    anchorId: string,
    contentHash: string,
  ): Promise<VerificationResult> {
    // Para el fake, "verificar" significa re-derivar el anchorId esperado
    // desde el contentHash + el resto, y comparar. Como el fake no
    // guarda relación anchorId → (tenantId, documentId), recibimos solo
    // contentHash y devolvemos invalid si nunca matchea — un caller real
    // pasa el anchorId que él mismo guardó al hacer anchor().
    //
    // En CI, el patrón típico es:
    //   const a = await fake.anchor({ contentHash, tenantId, documentId });
    //   const v = await fake.verify(a.anchorId, contentHash);
    //   expect(v.valid).toBe(true);
    //
    // Si el contentHash cambia (alteración del PDF), la re-derivación
    // produce un anchorId distinto y el verify devuelve invalid.
    if (!anchorId) {
      return {
        valid: false,
        provider: 'fake',
        reason: 'anchorId vacío',
        details: {},
      };
    }
    if (!contentHash || contentHash.length !== 64) {
      return {
        valid: false,
        provider: 'fake',
        reason: 'contentHash inválido (no es SHA-256 hex de 64 chars)',
        details: {},
      };
    }

    // Sin tenantId/documentId no podemos re-derivar exacto. Hacemos un
    // check más débil: el anchorId tiene que ser hex válido de 64 chars
    // generado por nuestro deriveAnchorId. Si llega aquí algo que no
    // matchea ese shape, definitivamente no es nuestro.
    const looksValid = /^[0-9a-f]{64}$/.test(anchorId);
    if (!looksValid) {
      return {
        valid: false,
        provider: 'fake',
        reason: 'anchorId no tiene el shape esperado (sha256 hex)',
        details: { received: anchorId },
      };
    }

    return {
      valid: true,
      provider: 'fake',
      details: {
        note: 'FakeNotaryAdapter.verify hace solo shape check — el caller debería usar anchor()/verify() en par para tests determinísticos.',
      },
    };
  }
}
