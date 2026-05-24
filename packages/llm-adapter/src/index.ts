// API pública del paquete @org/llm-adapter.
// Por ahora solo expone los tipos; los singletons `chat` y `embeddings` se
// agregan en el próximo commit junto con sus implementaciones.

export type {
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatProvider,
  EmbeddingsAdapter,
  EmbeddingsConfig,
  EmbeddingsProvider,
} from './lib/types.js';
