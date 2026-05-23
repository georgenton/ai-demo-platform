---
'@org/db': minor
---

Add the database layer for Demo 01:

- Postgres + pgvector via Docker Compose (reproducible local dev).
- Prisma 6 wired to the Postgres instance with the `postgresqlExtensions`
  preview enabling pgvector.
- `Document` and `Chunk` models with their first migration, including
  the `vector` extension and the proper indexes and cascade rules.
- A singleton-cached Prisma client exported from the package's public
  entry, plus re-exports of the `Prisma` namespace and model types so
  consumers can `import { prisma, type Document } from '@org/db'`.

The `embedding vector(N)` column on `Chunk` is intentionally deferred
to a future migration — its dimension depends on the embeddings model
to be picked.
