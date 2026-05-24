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

import { prisma } from '@org/db';

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
}

export class VectorStore {
  /**
   * Inserta chunks (con sus embeddings) para un Document existente, en una
   * sola transacción — si falla uno, no se guarda ninguno.
   *
   * Quien llama es responsable de crear el Document padre primero
   * (vía `prisma.document.create(...)`).
   */
  async saveChunks(documentId: string, chunks: ChunkToSave[]): Promise<void> {
    if (chunks.length === 0) return;

    await prisma.$transaction(
      chunks.map((chunk) => {
        // pgvector acepta el formato '[0.1,0.2,...]' y lo castea a vector.
        const vectorStr = `[${chunk.embedding.join(',')}]`;
        // NOTA: generamos el id con randomUUID() en lugar del default cuid()
        // de Prisma. El default solo se aplica al usar `prisma.chunk.create`;
        // con $executeRaw tenemos que generar el id en código de app.
        // Cuando este package crezca, podemos consolidar usando @paralleldrive/cuid2.
        return prisma.$executeRaw`
          INSERT INTO "Chunk" (id, content, "index", "documentId", embedding)
          VALUES (
            ${randomUUID()},
            ${chunk.content},
            ${chunk.index},
            ${documentId},
            ${vectorStr}::vector
          )
        `;
      }),
    );
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
    if (options.demoId) {
      return prisma.$queryRaw<ChunkSearchResult[]>`
        SELECT c.id, c.content, c."documentId", c."index",
               (c.embedding <=> ${vectorStr}::vector) AS distance
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        WHERE d."demoId" = ${options.demoId}
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${vectorStr}::vector
        LIMIT ${k}
      `;
    }

    return prisma.$queryRaw<ChunkSearchResult[]>`
      SELECT id, content, "documentId", "index",
             (embedding <=> ${vectorStr}::vector) AS distance
      FROM "Chunk"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${k}
    `;
  }
}
