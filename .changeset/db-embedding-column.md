---
'@org/db': minor
---

Add the `embedding vector(1536)` column on `Chunk` (nullable) plus an
HNSW index with `vector_cosine_ops`. Wires the database side of
[ADR-0008](../docs/adr/0008-openai-embeddings-for-dev.md) — OpenAI
text-embedding-3-small as the embeddings provider in dev.

The column is nullable because during ingest chunks may exist before
being embedded; the search code in `@org/rag-core` (still to be
implemented) will filter on non-null embeddings via `$queryRaw` and
the `<=>` cosine distance operator.

Backward compatible — no breaking changes to consumers of `@org/db`.
