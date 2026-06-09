// API pública del paquete @org/llm-adapter.
// Dos singletons (chat y embeddings) + factories + tipos. Ver ADR-0009.

export {
  chat,
  chatFor,
  createChatAdapter,
  isValidChatProvider,
  type ChatCallOptions,
} from './lib/chat.js';
export {
  embeddings,
  embeddingsFor,
  embeddingsInfoFor,
  createEmbeddingsAdapter,
  isValidEmbeddingsProvider,
  resolveEmbeddingsProvider,
  type EmbeddingsCallOptions,
  type EmbeddingsInfo,
} from './lib/embeddings.js';

export type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatProvider,
  ChatRichMessage,
  ChatTool,
  ChatUsage,
  EmbeddingsAdapter,
  EmbeddingsConfig,
  EmbeddingsProvider,
  StopReason,
  StreamWithUsage,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from './lib/types.js';
