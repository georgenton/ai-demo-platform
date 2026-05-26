-- NOTA: igual que en 20260526192420_add_academic_schema, Prisma volvió a
-- proponer DROP INDEX "Chunk_embedding_hnsw_idx" porque no modela índices
-- HNSW de pgvector. Lo removimos a mano para preservar el índice creado en
-- 20260524134805_add_chunk_embedding_column.

-- CreateTable
CREATE TABLE "AgentQuery" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT,
    "rowCount" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "turns" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentQuery_createdAt_idx" ON "AgentQuery"("createdAt" DESC);
