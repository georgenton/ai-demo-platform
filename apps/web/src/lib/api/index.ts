// Barrel del módulo de cliente HTTP. Re-exporta lo que el resto del frontend
// necesita importar, así los consumers escriben `from '@/lib/api'` y no
// `from '@/lib/api/<archivo>'` archivo por archivo.

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export { ApiError, ingestPdf, ingestText, subscribeToChat } from './client';
export { subscribeToCompare } from './compare';
export { subscribeToAgent, getAgentHistory } from './agent';
export { listDemos, getDemo } from './demos';
export {
  deleteDocument,
  getDocument,
  listDocumentChunks,
  listDocuments,
} from './documents';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export { useChatStream } from './use-chat-stream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ChatStreamStatus, UseChatStreamResult } from './use-chat-stream';
export type {
  ApiErrorPayload,
  ChatQuery,
  ChatStreamHandlers,
  ChatSubscription,
  DemoId,
  IngestFileRequest,
  IngestResponse,
  IngestTextRequest,
} from './types';
export type {
  CompareRequest,
  CompareStreamHandlers,
  CompareSubscription,
} from './types-compare';
export type {
  AgentEvent,
  AgentHistoryEntry,
  AgentHistoryQuery,
  AgentHistoryResponse,
  AgentRequest,
  AgentStreamHandlers,
  AgentSubscription,
  DoneEvent,
  ErrorEvent,
  TokenEvent,
  ToolCallEvent,
  ToolErrorEvent,
  ToolResultEvent,
} from './types-agent';
export type { DemoMetadata, DemoStatus } from './types-demos';
export type {
  ChunkSummary,
  DocumentDetail,
  DocumentSummary,
  ListDocumentsQuery,
  ListDocumentsResponse,
} from './types-documents';
