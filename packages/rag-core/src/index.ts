// API pública del paquete @org/rag-core.
// Por ahora exporta el Chunker (Strategy pattern) y el PromptBuilder.
// El EmbeddingService y el VectorStore se agregan en el próximo commit.

export {
  SlidingWindowChunker,
  type ChunkerStrategy,
  type SlidingWindowOptions,
} from './lib/chunker.js';

export {
  PromptBuilder,
  DEFAULT_SYSTEM_PROMPT,
  type PromptInput,
  type RetrievedChunk,
} from './lib/prompt-builder.js';
