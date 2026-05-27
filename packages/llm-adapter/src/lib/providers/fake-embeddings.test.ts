// -----------------------------------------------------------------------------
// Tests del FakeEmbeddingsAdapter. Verifican las tres propiedades clave:
//   1) Determinismo: mismo texto → mismo vector exacto.
//   2) Dimensión: 1536 (matchea pgvector).
//   3) Vector unitario: la norma L2 es ~1, así cosine = dot product.
//   4) Discriminación: textos diferentes producen vectores diferentes y
//      textos con vocabulario compartido tienen similarity > 0.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { FakeEmbeddingsAdapter } from './fake-embeddings.js';

const cfg = { provider: 'fake' as const, apiKey: 'x', model: 'x' };

/** Producto punto entre dos vectores de la misma longitud. */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Norma L2 (longitud) de un vector. */
function norm(a: number[]): number {
  let s = 0;
  for (const v of a) s += v * v;
  return Math.sqrt(s);
}

describe('FakeEmbeddingsAdapter', () => {
  it('devuelve vectores de dimensión 1536 (matchea pgvector)', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v = await adapter.embed('cualquier texto');
    expect(v).toHaveLength(1536);
  });

  it('es determinístico: mismo texto → vector idéntico', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v1 = await adapter.embed('reglamento académico');
    const v2 = await adapter.embed('reglamento académico');
    expect(v1).toEqual(v2);
  });

  it('produce vectores unitarios (norma ≈ 1)', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v = await adapter.embed('un documento de prueba con varias palabras');
    expect(norm(v)).toBeCloseTo(1, 5);
  });

  it('textos distintos producen vectores distintos', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v1 = await adapter.embed('matrícula período febrero');
    const v2 = await adapter.embed('propiedad intelectual autor');
    // Dot product muy cercano a 1 → vectores casi iguales. Tienen pocas
    // palabras en común (ninguna en el caso ideal), así que esperamos < 0.3.
    expect(dot(v1, v2)).toBeLessThan(0.3);
  });

  it('vocabulario compartido → similarity > 0', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v1 = await adapter.embed('recalificación de notas finales');
    const v2 = await adapter.embed('proceso de recalificación de notas');
    expect(dot(v1, v2)).toBeGreaterThan(0.4);
  });

  it('texto vacío no rompe (devuelve vector unitario válido)', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const v = await adapter.embed('');
    expect(v).toHaveLength(1536);
    expect(norm(v)).toBeCloseTo(1, 5);
  });

  it('embedMany es equivalente a llamar embed N veces', async () => {
    const adapter = new FakeEmbeddingsAdapter(cfg);
    const texts = ['uno', 'dos', 'tres'];
    const batch = await adapter.embedMany(texts);
    const individual = await Promise.all(texts.map((t) => adapter.embed(t)));
    expect(batch).toEqual(individual);
  });
});
