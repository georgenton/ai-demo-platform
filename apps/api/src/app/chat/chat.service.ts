// -----------------------------------------------------------------------------
// ChatService — orquesta el flujo de chat con RAG:
//   1) Embebe la pregunta                      (EmbeddingService)
//   2) Busca top-K chunks por similitud         (VectorStore)
//   3) Arma el prompt con los chunks            (PromptBuilder)
//   4) Stremea tokens del LLM                  (chat de @org/llm-adapter)
//
// Devuelve un AsyncIterable<string> — el controller lo convierte a Observable
// para SSE. Esto mantiene el service desacoplado de RxJS / NestJS-specifics.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { chat } from '@org/llm-adapter';
import type { ChatProvider } from '@org/llm-adapter';
import { EmbeddingService, PromptBuilder, VectorStore } from '@org/rag-core';

import type { ChatQueryDto } from './dto/chat.dto.js';

/** Default de top-K si el query no lo especifica. */
const DEFAULT_TOP_K = 5;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly vectorStore: VectorStore,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async *streamChat(
    query: ChatQueryDto,
    tenantId: string,
    llmProvider?: ChatProvider,
  ): AsyncIterable<string> {
    this.logger.log(
      `Chat for tenant=${tenantId} demo=${query.demoId}: "${query.q}" (topK=${query.topK ?? DEFAULT_TOP_K})`,
    );

    // 1) Embed de la pregunta.
    const questionVector = await this.embeddings.embed(query.q);

    // 2) Retrieval — chunks más cercanos al vector de la pregunta,
    //    filtrados por (tenantId, demoId).
    const topK = query.topK ?? DEFAULT_TOP_K;
    const chunks = await this.vectorStore.searchTopK(questionVector, topK, {
      tenantId,
      demoId: query.demoId,
    });
    this.logger.log(`Retrieved ${chunks.length} chunks`);

    // 3) Prompt — system instruction + chunks como contexto + pregunta.
    const messages = this.promptBuilder.build({
      question: query.q,
      chunks: chunks.map((c) => ({
        content: c.content,
        documentId: c.documentId,
        index: c.index,
      })),
    });

    // 4) Streaming del LLM — yield de cada token cuesta abajo. yield* delega
    //    al AsyncIterable del adapter sin envolverlo, así no pagamos overhead.
    yield* chat.completeStream(messages, { provider: llmProvider });
  }
}
