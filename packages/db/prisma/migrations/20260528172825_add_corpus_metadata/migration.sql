-- NOTA: `prisma migrate dev` propuso DROP INDEX "Chunk_embedding_hnsw_idx"
-- al generar esta migración porque ese índice no está declarado en
-- schema.prisma (Prisma 6 no modela índices HNSW de pgvector). Lo
-- removimos a mano para preservar el índice creado en la migración inicial
-- (20260524134805_add_chunk_embedding_column). Mismo patrón aplicado en
-- 20260526192420_add_academic_schema y 20260526200328_add_agent_query_audit.

-- AlterTable: campos de metadata del corpus (Demo 03). NULL para docs
-- de otros demos (rag/comparator) — no afecta sus consultas.
ALTER TABLE "Document" ADD COLUMN     "abstract" TEXT,
ADD COLUMN     "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "year" INTEGER;

-- CreateTable: tópicos extraídos por LLM de cada paper del corpus.
CREATE TABLE "DocumentTopic" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: para "top tópicos" del corpus — SELECT topic, COUNT(*) GROUP BY topic.
CREATE INDEX "DocumentTopic_topic_idx" ON "DocumentTopic"("topic");

-- CreateIndex: para listar tópicos de un paper específico.
CREATE INDEX "DocumentTopic_documentId_idx" ON "DocumentTopic"("documentId");

-- CreateIndex: para el bar chart de papers-by-year del Demo 03.
-- Compuesto con demoId para filtrar solo papers del corpus rápidamente.
CREATE INDEX "Document_demoId_year_idx" ON "Document"("demoId", "year");

-- AddForeignKey
ALTER TABLE "DocumentTopic" ADD CONSTRAINT "DocumentTopic_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
