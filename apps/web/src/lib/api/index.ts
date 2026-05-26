// Barrel del módulo de cliente HTTP. Re-exporta lo que el resto del frontend
// necesita importar, así los consumers escriben `from '@/lib/api'` y no
// `from '@/lib/api/client'` archivo por archivo.

export { ApiError, ingestPdf, ingestText, subscribeToChat } from './client';
export { useChatStream } from './use-chat-stream';
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
