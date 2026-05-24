---
'@org/rag-core': minor
---

`VectorStore.saveChunks` ahora acepta un `tx?: Prisma.TransactionClient`
opcional. Cuando se provee, los `INSERT` de chunks corren dentro de esa
transacción interactiva externa — lo que permite a quien llama atomicidad
real entre `Document.create` y los chunks (sin Documents huérfanos).

Cuando se omite, el comportamiento es el mismo de antes: una
`$transaction` batched propia, garantizando atomicidad chunk→chunk
estandalone. **Backward compatible** — el primer parámetro y el segundo
no cambiaron.

`IngestService` en `apps/api` ya usa esta capacidad: envuelve
`Document.create` + `saveChunks(...)` con `prisma.$transaction(async (tx)
=> ...)`. Reemplaza el compensating-action manual (try/catch +
`document.delete`) que existía antes.
