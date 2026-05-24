# ADR-0005 — pgvector en lugar de una base vectorial dedicada

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El RAG requiere guardar y buscar **vectores de embeddings** por
similitud. Hay dos caminos:

- Una base vectorial dedicada (Pinecone, Qdrant, Weaviate, Milvus).
- Una extensión sobre la base relacional que ya usamos (`pgvector`
  sobre PostgreSQL).

El proyecto va a desplegarse on-premise en el cliente, dentro de la
infraestructura de NAI.

## Decisión

**PostgreSQL 17 con la extensión `pgvector`.** Una sola base para
documentos, chunks y vectores. Búsquedas de similitud con `$queryRaw`
de Prisma (Prisma no maneja el tipo `vector` de pgvector de forma
nativa todavía).

## Alternativas consideradas

### Opción A — Pinecone (SaaS)

- **Pros:** mejor performance a gran escala, sin overhead operacional.
- **Contras:** **SaaS** — no es viable on-premise. El cliente quiere
  sus datos dentro de su datacenter. **Descalifica.**

### Opción B — Qdrant / Weaviate / Milvus (self-hosted)

- **Pros:** features avanzadas (filtros complejos, payload structures),
  performance a muchos millones de vectores.
- **Contras:** otra base más para operar (backups, monitoring,
  versionado, recovery). Para el volumen esperado del Demo 01 y 02
  (un reglamento, unos contratos), es overkill.

### Opción C — pgvector

- **Pros:** sumar una **extensión** a un Postgres que ya íbamos a tener
  igual. Una sola base, un solo backup, una sola conexión. Operacional
  simple. Performance suficiente para nuestro volumen.
- **Contras:** menos features vectoriales avanzadas que Qdrant. Para
  cientos de millones de vectores podría no escalar.

### Opción elegida — pgvector

- **Por qué ganó:** el volumen esperado entra cómodo. Operacionalmente
  trivial (una sola base). On-premise sin agregar pieza. Si crece más
  allá del límite, migrar a una base dedicada es viable porque la
  abstracción `VectorStore` en `@org/rag-core` aísla la implementación.

## Consecuencias

### Positivas

- **Una sola base** para operar — un solo backup, un solo monitoring.
- Cero costo extra de infraestructura.
- Transacciones que combinan datos relacionales y vectoriales son
  atómicas (insertar un Document con sus Chunks + sus vectores en una
  sola transacción).
- pgvector está maduro (v0.8.x), bien soportado en Docker
  (`pgvector/pgvector:pg17`).

### Negativas / costos

- Prisma no soporta `vector` como tipo nativo todavía. La columna se
  declara con `Unsupported("vector(N)")` y las queries de similitud se
  hacen con `$queryRaw`. Hay un poquito de SQL crudo en `VectorStore`.
- Algunas features de bases vectoriales dedicadas (filtros con índices
  vectoriales híbridos, sharding) no están.

### Riesgos / cosas a vigilar

- Performance a partir de **millones de vectores** — pgvector con
  índice HNSW maneja bien, pero hay que monitorear.
- La dimensión del vector va embebida en la columna; cambiar de modelo
  de embeddings (con dimensión distinta) requiere migración.

## Cuándo revisar

- Si llegamos a 10M+ vectores y la búsqueda se degrada incluso con HNSW.
- Si necesitamos features que pgvector no tiene (multi-tenancy con
  partición vectorial, etc.).

## Referencias

- [pgvector — repo y docs](https://github.com/pgvector/pgvector)
- [`docs/architecture/02-containers.md`](../architecture/02-containers.md)
- [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)
