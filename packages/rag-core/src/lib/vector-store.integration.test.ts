// -----------------------------------------------------------------------------
// Integration tests del VectorStore contra un Postgres+pgvector real.
//
// Por qué integration tests (y no solo unit tests con mocks):
//   - Verifican el SQL real, no nuestra fe en que `Prisma.sql` arme bien la
//     query.
//   - Validan la semántica de pgvector (operador `<=>` = distancia coseno) y
//     que el índice HNSW devuelva el orden esperado.
//   - Confirman que la transacción interactiva HACE rollback de los chunks
//     cuando el callback externo falla (no podemos verificarlo con mocks
//     porque el rollback lo hace el motor de la DB).
//
// Cómo se corren:
//   `npm run test:integration` (excluidos del `npm test` default por ser
//   lentos: cada archivo de integration arranca un container Postgres).
//
// Estrategia de aislamiento:
//   - Un container por archivo de test (beforeAll/afterAll).
//   - TRUNCATE de las tablas en beforeEach — cada test arranca con DB vacía.
//   - Los imports de @org/db y VectorStore son DINÁMICOS (dentro de
//     beforeAll), después de setear DATABASE_URL — así el singleton de
//     `prisma` se inicializa contra el container, no contra la DB de dev.
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Tipos lazy — los módulos reales se importan dinámicamente en beforeAll.
type PrismaClient = typeof import('@org/db').prisma;
type VectorStoreClass = typeof import('./vector-store.js').VectorStore;

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let vectorStore: InstanceType<VectorStoreClass>;

/** Dimensión del vector que define el schema (text-embedding-3-small). */
const DIM = 1536;

/** Helper: vector 1536-dim con `1` en `index`, ceros en el resto. */
function unitVector(index: number): number[] {
  const v = new Array<number>(DIM).fill(0);
  v[index] = 1;
  return v;
}

describe('VectorStore (integration)', () => {
  beforeAll(async () => {
    // 1) Levantamos un Postgres+pgvector aislado, misma imagen que en dev
    //    (docker-compose.yml) para que el comportamiento sea idéntico.
    container = await new PostgreSqlContainer('pgvector/pgvector:pg17').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    // 2) Aplicamos las migraciones del repo al container fresco. `deploy`
    //    es la variante no-interactiva de `migrate dev`: pensada para CI,
    //    prod y tests — no genera nada, solo aplica lo que ya existe.
    execSync(
      'npx prisma migrate deploy --schema packages/db/prisma/schema.prisma',
      { env: process.env, stdio: 'inherit' },
    );

    // 3) AHORA es seguro importar — el singleton de @org/db agarra la URL
    //    del container al inicializarse.
    const dbModule = await import('@org/db');
    const vectorStoreModule = await import('./vector-store.js');
    prisma = dbModule.prisma;
    vectorStore = new vectorStoreModule.VectorStore();
  }, 120_000); // testcontainers + image pull + migrations: ~30–90s la primera vez

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    // Limpieza entre tests. CASCADE arrastra los chunks vía el FK.
    await prisma.$executeRaw`TRUNCATE "Chunk", "Document" CASCADE`;
  });

  // ===========================================================================
  // saveChunks — modo standalone (sin tx)
  // ===========================================================================

  describe('saveChunks (sin tx)', () => {
    it('inserta los chunks y persiste sus embeddings', async () => {
      const doc = await prisma.document.create({
        data: { name: 'doc.txt', content: 'x', demoId: 'rag' },
      });

      await vectorStore.saveChunks(doc.id, [
        { content: 'chunk a', index: 0, embedding: unitVector(0) },
        { content: 'chunk b', index: 1, embedding: unitVector(1) },
      ]);

      // Verificamos via Prisma típico (no podemos SELECT el campo embedding
      // porque es Unsupported, pero el resto sí).
      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
        orderBy: { index: 'asc' },
      });
      expect(chunks.map((c) => c.content)).toEqual(['chunk a', 'chunk b']);
      expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    });

    it('es no-op para un array vacío de chunks', async () => {
      const doc = await prisma.document.create({
        data: { name: 'doc.txt', content: 'x', demoId: 'rag' },
      });
      await vectorStore.saveChunks(doc.id, []);
      expect(await prisma.chunk.count()).toBe(0);
    });
  });

  // ===========================================================================
  // saveChunks — modo cooperativo (con tx)
  // ===========================================================================

  describe('saveChunks (con tx)', () => {
    it('participa de una transacción interactiva externa', async () => {
      // Document + chunks en UNA SOLA transacción — esto es lo que hace
      // IngestService en producción.
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: { name: 'doc.txt', content: 'x', demoId: 'rag' },
        });
        await vectorStore.saveChunks(
          doc.id,
          [{ content: 'inside tx', index: 0, embedding: unitVector(0) }],
          tx,
        );
        return doc;
      });

      expect(await prisma.chunk.count()).toBe(1);
      expect(await prisma.document.count()).toBe(1);
      expect(result.name).toBe('doc.txt');
    });

    it('hace rollback de TODO si el callback externo lanza', async () => {
      // Este es el caso que justifica que VectorStore sea tx-aware:
      // si los chunks se insertan dentro del mismo tx que el Document,
      // un throw en el callback rollbackea TODO — incluso el Document
      // que ya parecía creado.
      await expect(
        prisma.$transaction(async (tx) => {
          const doc = await tx.document.create({
            data: { name: 'doc.txt', content: 'x', demoId: 'rag' },
          });
          await vectorStore.saveChunks(
            doc.id,
            [
              {
                content: 'should be rolled back',
                index: 0,
                embedding: unitVector(0),
              },
            ],
            tx,
          );
          throw new Error('algo falló en pasos posteriores');
        }),
      ).rejects.toThrow('algo falló');

      // Tanto Document como Chunks deben haber sido rollbackeados.
      expect(await prisma.document.count()).toBe(0);
      expect(await prisma.chunk.count()).toBe(0);
    });
  });

  // ===========================================================================
  // searchTopK — el RAG retrieval real
  // ===========================================================================

  describe('searchTopK', () => {
    let docId: string;

    beforeEach(async () => {
      // Cada test de búsqueda arranca con 3 chunks de vectores conocidos.
      const doc = await prisma.document.create({
        data: { name: 'doc.txt', content: 'x', demoId: 'rag' },
      });
      docId = doc.id;

      await vectorStore.saveChunks(doc.id, [
        { content: 'idéntico al query', index: 0, embedding: unitVector(0) },
        { content: 'ortogonal al query', index: 1, embedding: unitVector(1) },
        {
          content: 'también idéntico al query',
          index: 2,
          embedding: unitVector(0),
        },
      ]);
    });

    it('devuelve top-K ordenado por distancia coseno ascendente', async () => {
      const results = await vectorStore.searchTopK(unitVector(0), 3);
      expect(results).toHaveLength(3);

      // Los dos chunks idénticos al query tienen distancia ~0 (vienen
      // primero); el ortogonal tiene distancia ~1 (viene último).
      expect(results[0].distance).toBeCloseTo(0, 5);
      expect(results[1].distance).toBeCloseTo(0, 5);
      expect(results[2].distance).toBeCloseTo(1, 5);
      expect(results[2].content).toBe('ortogonal al query');
    });

    it('respeta el límite k', async () => {
      const results = await vectorStore.searchTopK(unitVector(0), 2);
      expect(results).toHaveLength(2);
    });

    it('lanza si k <= 0', async () => {
      await expect(vectorStore.searchTopK(unitVector(0), 0)).rejects.toThrow(
        /k/,
      );
      await expect(vectorStore.searchTopK(unitVector(0), -1)).rejects.toThrow(
        /k/,
      );
    });

    it('filtra por demoId cuando se provee', async () => {
      // Sumamos un Document de OTRO demo con un chunk también idéntico al
      // query — debería aparecer solo cuando filtramos por su demo.
      const otherDoc = await prisma.document.create({
        data: { name: 'other.txt', content: 'x', demoId: 'comparator' },
      });
      await vectorStore.saveChunks(otherDoc.id, [
        { content: 'del otro demo', index: 0, embedding: unitVector(0) },
      ]);

      // Filtrando por 'rag' solo aparecen chunks del primer doc.
      const ragResults = await vectorStore.searchTopK(unitVector(0), 10, {
        demoId: 'rag',
      });
      expect(ragResults).toHaveLength(3);
      expect(ragResults.every((r) => r.documentId === docId)).toBe(true);

      // Filtrando por 'comparator' solo aparece el chunk del otro doc.
      const compResults = await vectorStore.searchTopK(unitVector(0), 10, {
        demoId: 'comparator',
      });
      expect(compResults).toHaveLength(1);
      expect(compResults[0].documentId).toBe(otherDoc.id);
    });
  });
});
