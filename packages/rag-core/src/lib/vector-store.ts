// -----------------------------------------------------------------------------
// VectorStore — guarda chunks con sus embeddings y busca por similitud
// usando pgvector.
//
// Prisma no maneja el tipo `vector` de pgvector de forma nativa, así que las
// queries usan `$queryRaw` / `$executeRaw`. Este es el ÚNICO lugar del
// proyecto que toca el tipo vector y/o escribe SQL crudo — Repository
// pattern, ver CLAUDE.md.
//
// Notas sobre tests: las queries son SQL crudo difícil de mockear con valor
// real (mockear el tagged template de Prisma resulta frágil y no prueba la
// query). La cobertura real viene de los tests de integración cuando apps/api
// use este package con la base real corriendo.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

import { Prisma, prisma } from '@org/db';

export interface ChunkToSave {
  content: string;
  index: number;
  embedding: number[];
}

export interface ChunkSearchResult {
  id: string;
  content: string;
  documentId: string;
  index: number;
  /** Distancia coseno: 0 = idéntico, 2 = opuesto. Menor = más similar. */
  distance: number;
}

export interface SearchOptions {
  /** Si se provee, solo se buscan chunks de documentos de este demo. */
  demoId?: string;
  /**
   * Filtro multi-tenant (ADR-0013). Si se provee, sólo se buscan chunks de
   * documentos del tenant. Si no se provee, la búsqueda no filtra por
   * tenant — peligroso en producción multi-tenant; el caller debe pasarlo
   * salvo en scripts de mantenimiento.
   */
  tenantId?: string;
  /**
   * Provider de embeddings con el que fue generado el `queryEmbedding`.
   * Cuando se provee (junto con `embeddingsModel`), la búsqueda filtra los
   * chunks para SOLO incluir aquellos cuyo Document fue indexado con el
   * mismo par (provider, model). Es la guardia que impide cruzar espacios
   * vectoriales — ver ADR-0018.
   *
   * Si se omite, no se filtra por embeddings provider (modo legacy /
   * compatibilidad con código pre-ADR-0018 que solo tenía un provider).
   */
  embeddingsProvider?: string;
  /** Modelo de embeddings. Solo aplica si `embeddingsProvider` también está. */
  embeddingsModel?: string;
}

export class VectorStore {
  /**
   * Inserta chunks (con sus embeddings) para un Document existente.
   *
   * Dos modos:
   *   - **Sin `tx`** (modo standalone): abre su propia $transaction batched
   *     — los chunks suceden todos o ninguno entre sí. Útil si quien llama
   *     ya creó el Document por separado y solo quiere atomicidad chunk→chunk.
   *   - **Con `tx`** (modo cooperativo): los INSERTs se ejecutan dentro de
   *     la transacción interactiva externa. Quien llama tiene la
   *     responsabilidad de también crear el Document dentro del mismo `tx`
   *     — así Document + Chunks son atómicos juntos. Si algo en el callback
   *     externo falla, Prisma rollbackea TODO (incluso el Document creado).
   *     Es lo que IngestService usa para evitar Documents huérfanos.
   */
  async saveChunks(
    documentId: string,
    chunks: ChunkToSave[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Construimos el SQL de cada INSERT una sola vez; lo usan ambos modos.
    const inserts = chunks.map((chunk) =>
      this.buildChunkInsertSql(documentId, chunk),
    );

    if (tx) {
      // Ya estamos dentro de una transacción interactiva externa.
      // Ejecutamos los INSERTs secuencialmente con el cliente transaccional.
      for (const sql of inserts) {
        await tx.$executeRaw(sql);
      }
    } else {
      // Modo standalone — nuestra propia transacción batched.
      await prisma.$transaction(inserts.map((sql) => prisma.$executeRaw(sql)));
    }
  }

  /** Helper privado: construye el SQL de un INSERT de Chunk con su vector. */
  private buildChunkInsertSql(
    documentId: string,
    chunk: ChunkToSave,
  ): Prisma.Sql {
    // pgvector acepta el formato '[0.1,0.2,...]' y lo castea a vector.
    const vectorStr = `[${chunk.embedding.join(',')}]`;
    // NOTA sobre el id: generamos UUID con node:crypto en lugar del
    // @default(cuid()) del schema, que solo aplica al usar
    // prisma.chunk.create. Con $executeRaw tenemos que poner el id a mano.
    return Prisma.sql`
      INSERT INTO "Chunk" (id, content, "index", "documentId", embedding)
      VALUES (
        ${randomUUID()},
        ${chunk.content},
        ${chunk.index},
        ${documentId},
        ${vectorStr}::vector
      )
    `;
  }

  /**
   * Encuentra los `k` chunks más similares al vector consulta. Resultados
   * ordenados por distancia coseno ascendente (más similar primero).
   *
   * Usa el índice HNSW sobre Chunk.embedding (creado en la migración
   * 20260524134805_add_chunk_embedding_column) → log(n) en vez de scan
   * secuencial.
   */
  async searchTopK(
    queryEmbedding: number[],
    k: number,
    options: SearchOptions = {},
  ): Promise<ChunkSearchResult[]> {
    if (k <= 0) {
      throw new Error('VectorStore.searchTopK: k debe ser > 0.');
    }

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // `<=>` es el operador de distancia coseno de pgvector, alineado con el
    // op-class del índice HNSW (vector_cosine_ops). Lower = más similar.
    //
    // Composición del WHERE: armamos un array de fragmentos `Prisma.sql` por
    // cada filtro presente y los unimos con AND. Si no viene NINGÚN filtro,
    // saltamos el JOIN (path legacy más rápido — el plan usa HNSW directo).
    const needsJoin =
      Boolean(options.tenantId) ||
      Boolean(options.demoId) ||
      Boolean(options.embeddingsProvider);

    if (!needsJoin) {
      return prisma.$queryRaw<ChunkSearchResult[]>`
        SELECT id, content, "documentId", "index",
               (embedding <=> ${vectorStr}::vector) AS distance
        FROM "Chunk"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${k}
      `;
    }

    // Path con JOIN — armamos los WHEREs dinámicamente.
    const conditions: Prisma.Sql[] = [Prisma.sql`c.embedding IS NOT NULL`];
    if (options.tenantId) {
      conditions.push(Prisma.sql`d."tenantId" = ${options.tenantId}`);
    }
    if (options.demoId) {
      conditions.push(Prisma.sql`d."demoId" = ${options.demoId}`);
    }
    // Filtro de espacio vectorial (ADR-0018). Solo aplica si el caller
    // pasó ambos: provider y model. Garantiza que no comparemos vectores
    // que viven en idiomas semánticos distintos.
    if (options.embeddingsProvider && options.embeddingsModel) {
      conditions.push(
        Prisma.sql`d."embeddingsProvider" = ${options.embeddingsProvider}`,
      );
      conditions.push(
        Prisma.sql`d."embeddingsModel" = ${options.embeddingsModel}`,
      );
    }
    const whereClause = Prisma.join(conditions, ' AND ');

    return prisma.$queryRaw<ChunkSearchResult[]>`
      SELECT c.id, c.content, c."documentId", c."index",
             (c.embedding <=> ${vectorStr}::vector) AS distance
      FROM "Chunk" c
      JOIN "Document" d ON c."documentId" = d.id
      WHERE ${whereClause}
      ORDER BY c.embedding <=> ${vectorStr}::vector
      LIMIT ${k}
    `;
  }
}
