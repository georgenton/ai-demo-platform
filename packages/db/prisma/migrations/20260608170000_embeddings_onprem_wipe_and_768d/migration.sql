-- =============================================================================
-- Embeddings on-prem only — wipe + cambio de dimensión 1536 → 768
-- =============================================================================
--
-- CONTEXTO (ver ADR-0018, que esta migración introduce):
--
--   El proyecto pivota de "embeddings cloud (OpenAI text-embedding-3-small,
--   1536 dim)" a "embeddings 100% on-prem (nomic-embed-text servido por NAI
--   en el Mac, 768 dim)". Razones:
--
--     1. El mensaje comercial es Nutanix Enterprise AI on-prem. El RAG
--        corriendo sobre el hardware del cliente ES la demo del producto.
--     2. Tras PR #90 (private-mac provider), Railway ya está configurado
--        con EMBEDDINGS_PROVIDER=private-mac pero la columna seguía siendo
--        vector(1536). Cualquier ingest nuevo fallaba en runtime y los 660
--        chunks viejos (1536d, generados con OpenAI) quedaron huérfanos
--        — sin OPENAI_API_KEY no había forma de consultarlos.
--     3. ADR-0008 quedó obsoleto y este cambio lo formaliza.
--
-- LO QUE HACE ESTA MIGRACIÓN:
--
--   1. Wipe de los 660 chunks viejos y los 11 Documents que los contenían.
--      Es data de prueba, no producción real. Se confirmó con Codex el
--      8 de junio de 2026.
--
--   2. DROP de la columna `embedding vector(1536)` y su índice HNSW.
--      pgvector no permite ALTER COLUMN para cambiar la dimensión — hay
--      que recrear.
--
--   3. ADD de la nueva columna `embedding vector(768)` y su índice HNSW
--      con vector_cosine_ops (consistente con el operador `<=>` usado en
--      VectorStore.searchTopK).
--
--   4. ADD de tres campos a Document para registrar con qué provider /
--      modelo / dimensión fue indexado cada documento:
--        - embeddingsProvider  TEXT  ('private-mac' por ahora; futuros
--                                     proveedores se agregan al union sin
--                                     migración de schema).
--        - embeddingsModel     TEXT  (nombre del modelo concreto:
--                                     'nomic-embed-text', etc.).
--        - embeddingsDim       INT   (dimensión real del vector — 768 hoy).
--
--      Defaults: 'private-mac' / 'nomic-embed-text' / 768. No hay registros
--      para backfillar (los 11 Documents se borran en el paso 1) — los
--      defaults solo aplican a inserts futuros donde el caller no los
--      especifique (raro: IngestService los va a poblar siempre).
--
-- IRREVERSIBILIDAD:
--
--   Esta migración borra los 660 chunks de Railway. Confirmado con el
--   dueño del repo antes de mergear. Si en el futuro alguien necesita los
--   datos viejos, recuperar del backup de Railway anterior al 8 de junio.
--
-- ROLLBACK MANUAL (si hace falta):
--
--   ALTER TABLE "Document" DROP COLUMN "embeddingsDim";
--   ALTER TABLE "Document" DROP COLUMN "embeddingsModel";
--   ALTER TABLE "Document" DROP COLUMN "embeddingsProvider";
--   DROP INDEX "Chunk_embedding_hnsw_idx";
--   ALTER TABLE "Chunk" DROP COLUMN "embedding";
--   ALTER TABLE "Chunk" ADD COLUMN "embedding" vector(1536);
--   CREATE INDEX "Chunk_embedding_hnsw_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);
--
--   Los datos NO se recuperan con el rollback — solo el shape del schema.
-- =============================================================================


-- 1. Wipe de chunks + documents -----------------------------------------------
--
-- Borramos en el orden seguro: primero chunks (hijos), luego documents
-- (padres). El ON DELETE CASCADE de Chunk.documentId aplicaría igual si solo
-- borráramos Document, pero hacerlo explícito vuelve la migración legible y
-- evita confiar en un side-effect.
--
-- DocumentTopic se borra por cascade desde Document (declarado en schema.prisma
-- con onDelete: Cascade) — no hace falta DELETE explícito.

DELETE FROM "Chunk";
DELETE FROM "Document";


-- 2. Drop columna vieja embedding (1536d) + su índice -------------------------
--
-- Orden obligatorio: primero el índice, luego la columna. Postgres impide
-- droppear una columna que tiene un índice asociado.

DROP INDEX IF EXISTS "Chunk_embedding_hnsw_idx";
ALTER TABLE "Chunk" DROP COLUMN "embedding";


-- 3. Add columna nueva embedding (768d) + nuevo índice ------------------------
--
-- Nullable porque durante el ingest puede haber chunks recién creados sin
-- embedding todavía (caso defensivo; el ingest siempre los popula en la
-- misma transacción).
--
-- El índice HNSW con vector_cosine_ops es consistente con el operador `<=>`
-- (distancia coseno) usado en VectorStore.searchTopK. Mismo nombre que el
-- índice anterior — la app espera ese nombre lógico.

ALTER TABLE "Chunk" ADD COLUMN "embedding" vector(768);

CREATE INDEX "Chunk_embedding_hnsw_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);


-- 4. Add metadata de embeddings a Document ------------------------------------
--
-- Para que el RAG sepa con qué proveedor/modelo se indexó cada documento
-- (auditoría + UI). Hoy todos serán 'private-mac' / 'nomic-embed-text' / 768
-- por la decisión de ADR-0018, pero el schema acepta valores arbitrarios
-- para no atarnos al provider único.
--
-- NOT NULL con DEFAULT: el ingest siempre los va a setear; los defaults son
-- una red de seguridad para inserts directos (scripts, seed) que se olviden.

ALTER TABLE "Document"
  ADD COLUMN "embeddingsProvider" TEXT NOT NULL DEFAULT 'private-mac',
  ADD COLUMN "embeddingsModel"    TEXT NOT NULL DEFAULT 'nomic-embed-text',
  ADD COLUMN "embeddingsDim"      INTEGER NOT NULL DEFAULT 768;


-- 5. Índice de cobertura para filtrar por provider en búsquedas ---------------
--
-- El VectorStore.searchTopK del próximo sub-PR filtrará por
-- Document.embeddingsProvider para garantizar que solo se comparen vectores
-- del mismo espacio. Este índice acelera el join + WHERE en producción.

CREATE INDEX "Document_embeddings_provider_idx"
  ON "Document" ("tenantId", "demoId", "embeddingsProvider", "embeddingsModel");
