// API pública del paquete @org/llm-adapter.
// Dos singletons (chat y embeddings) + factories + tipos. Ver ADR-0009.

export { chat, createChatAdapter } from './lib/chat.js';
export { embeddings, createEmbeddingsAdapter } from './lib/embeddings.js';

export type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatProvider,
  ChatRichMessage,
  ChatTool,
  EmbeddingsAdapter,
  EmbeddingsConfig,
  EmbeddingsProvider,
  StopReason,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from './lib/types.js';
