// API pública del paquete @org/llm-adapter.
// Dos singletons (chat y embeddings) + factories + tipos. Ver ADR-0009.

export { chat, createChatAdapter } from './lib/chat.js';
export { embeddings, createEmbeddingsAdapter } from './lib/embeddings.js';

export type {
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatProvider,
  EmbeddingsAdapter,
  EmbeddingsConfig,
  EmbeddingsProvider,
} from './lib/types.js';
