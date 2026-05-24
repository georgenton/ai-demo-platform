-- AlterTable: agregar la columna embedding. Nullable porque durante la
-- ingesta puede haber chunks recién creados sin embedding todavía.
ALTER TABLE "Chunk" ADD COLUMN "embedding" vector(1536);

-- CreateIndex: índice HNSW para búsqueda por similitud rápida.
-- Prisma no modela índices de pgvector, así que lo agregamos a mano.
--   - 'hnsw' es el algoritmo (Hierarchical Navigable Small Worlds), ideal
--     para RAG: gran recall, búsqueda log(n).
--   - 'vector_cosine_ops' indica que la búsqueda usa distancia coseno
--     (operador `<=>`), consistente con el modelo de embeddings elegido.
CREATE INDEX "Chunk_embedding_hnsw_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);
