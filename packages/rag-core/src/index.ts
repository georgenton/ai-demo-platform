// API pública del paquete @org/rag-core.
// Cuatro componentes que juntos forman el pipeline de RAG:
//   - Chunker  → parte texto en fragmentos.
//   - EmbeddingService → convierte fragmentos en vectores.
//   - VectorStore → guarda y busca vectores en pgvector.
//   - PromptBuilder → arma el prompt final para el LLM.

export {
  SlidingWindowChunker,
  type ChunkerStrategy,
  type SlidingWindowOptions,
} from './lib/chunker.js';

export { EmbeddingService } from './lib/embedding-service.js';

export {
  VectorStore,
  type ChunkSearchResult,
  type ChunkToSave,
  type SearchOptions,
} from './lib/vector-store.js';

export {
  DEFAULT_SYSTEM_PROMPT,
  PromptBuilder,
  type PromptInput,
  type RetrievedChunk,
} from './lib/prompt-builder.js';
