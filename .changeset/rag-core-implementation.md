---
'@org/rag-core': minor
---

Implementa el pipeline de RAG en cuatro clases listas para que
`apps/api` las orqueste.

- **`SlidingWindowChunker`** (`ChunkerStrategy`) — divide un texto en
  ventanas de tamaño fijo en caracteres con solapamiento.
- **`EmbeddingService`** — wrapper sobre `@org/llm-adapter` con
  batching configurable (default 100).
- **`VectorStore`** — `saveChunks()` + `searchTopK()` sobre pgvector,
  usando el índice HNSW para búsqueda log(n). Único lugar del proyecto
  que escribe SQL crudo (Repository pattern).
- **`PromptBuilder`** + `DEFAULT_SYSTEM_PROMPT` — arma el prompt final
  con las reglas anti-alucinación del Demo 01.

Uso:

```ts
import {
  SlidingWindowChunker,
  EmbeddingService,
  VectorStore,
  PromptBuilder,
} from '@org/rag-core';

const chunker = new SlidingWindowChunker({ size: 800, overlap: 100 });
const chunks = chunker.split(longText);

const service = new EmbeddingService();
const vectors = await service.embedMany(chunks);

const store = new VectorStore();
await store.saveChunks(
  documentId,
  chunks.map((content, index) => ({
    content,
    index,
    embedding: vectors[index],
  })),
);

const queryVector = await service.embed('una pregunta');
const top = await store.searchTopK(queryVector, 5);

const messages = new PromptBuilder().build({
  question: 'una pregunta',
  chunks: top,
});
```

Incluye 20 tests Vitest sobre la lógica pura (Chunker + PromptBuilder

- EmbeddingService con mock del adapter). El `VectorStore` se cubre
  con tests de integración cuando `apps/api` lo use.
