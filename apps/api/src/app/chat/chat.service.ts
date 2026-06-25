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

import {
  chat,
  embeddingsInfoFor,
  resolveEmbeddingsProvider,
} from '@org/llm-adapter';
import type { ChatProvider, EmbeddingsProvider } from '@org/llm-adapter';
import { EmbeddingService, PromptBuilder, VectorStore } from '@org/rag-core';

import { TokenQuotaService } from '../quota/token-quota.service.js';

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
    private readonly tokenQuota: TokenQuotaService,
  ) {}

  /**
   * Orquesta una pregunta RAG end-to-end: embed → retrieval filtrado por
   * espacio vectorial → prompt → streaming.
   *
   * Si `llmProvider === 'anthropic'` (que no tiene embeddings), caemos al
   * `EMBEDDINGS_PROVIDER` del env (típicamente OpenAI). Decisión renovada
   * de Q2 2026: el Mac on-prem está offline y NAI no está instalado, así
   * que el RAG en producción necesita un fallback cloud para embeddings
   * cuando el chat va a Anthropic. ADR-0018 documenta el "on-prem
   * preferido"; este fallback no lo invalida — sigue siendo el preferido
   * cuando hay infra. Solo deja de bloquear al user cuando NO la hay.
   */
  async *streamChat(
    query: ChatQueryDto,
    tenantId: string,
    llmProvider?: ChatProvider,
    userId?: string,
  ): AsyncIterable<string> {
    this.logger.log(
      `Chat for tenant=${tenantId} demo=${query.demoId}: "${query.q}" ` +
        `(topK=${query.topK ?? DEFAULT_TOP_K}, llmProvider=${llmProvider ?? 'env default'})`,
    );

    // 0) Resolver embeddings provider desde el chat provider activo. Si el
    //    chat es Anthropic, `resolveEmbeddingsProvider` devuelve null —
    //    en ese caso dejamos `embeddingsProvider` undefined y el adapter
    //    cae al `EMBEDDINGS_PROVIDER` del env (en producción = openai).
    //    Para los demás providers, el embeddings sigue el chat.
    let embeddingsProvider: EmbeddingsProvider | undefined;
    if (llmProvider) {
      const mapped = resolveEmbeddingsProvider(llmProvider);
      if (mapped !== null) {
        embeddingsProvider = mapped;
      }
      // null (anthropic) → embeddingsProvider queda undefined → env default.
    }

    // 1) Embed de la pregunta usando el mismo provider que se usó al indexar.
    const embedOpts = embeddingsProvider
      ? { provider: embeddingsProvider }
      : undefined;
    const questionVector = await this.embeddings.embed(query.q, embedOpts);

    // 2) Retrieval — chunks más cercanos, filtrados por (tenantId, demoId)
    //    Y por el mismo espacio vectorial (provider + model) que vamos a
    //    consultar. Sin este filtro podríamos traer chunks indexados con
    //    OpenAI (1536d) y compararlos con un vector NAI (768d) — pgvector
    //    rechazaría por dim mismatch o, peor, daría resultados aleatorios
    //    si las dim coincidieran por casualidad.
    const info = embeddingsInfoFor(
      embeddingsProvider ??
        (process.env.EMBEDDINGS_PROVIDER as
          | 'openai'
          | 'openai-compat'
          | 'private-mac'
          | 'fake'),
    );
    const topK = query.topK ?? DEFAULT_TOP_K;
    const chunks = await this.vectorStore.searchTopK(questionVector, topK, {
      tenantId,
      demoId: query.demoId,
      embeddingsProvider: info.provider,
      embeddingsModel: info.model,
    });
    this.logger.log(
      `Retrieved ${chunks.length} chunks (embeddings=${info.provider}/${info.model})`,
    );

    // 3) Prompt — system instruction + chunks como contexto + pregunta.
    const messages = this.promptBuilder.build({
      question: query.q,
      chunks: chunks.map((c) => ({
        content: c.content,
        documentId: c.documentId,
        index: c.index,
      })),
    });

    // 4) Streaming del LLM — yield de cada token cuesta abajo, contando
    //    chars de input (messages) y output (tokens) para registrar el
    //    consumo al cierre. Sin el record, el guard global de quota nunca
    //    sumaría y el rate limit no funcionaría.
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    let outputChars = 0;
    try {
      for await (const token of chat.completeStream(messages, {
        provider: llmProvider,
      })) {
        outputChars += token.length;
        yield token;
      }
    } finally {
      // Registramos aunque el stream se haya cortado a mitad (cliente
      // canceló, error en el LLM): los tokens ya consumidos cuentan.
      if (userId) {
        const provider = llmProvider ?? process.env.CHAT_PROVIDER ?? 'unknown';
        void this.tokenQuota
          .recordEstimated({
            userId,
            tenantId,
            demoId: query.demoId,
            inputChars,
            outputChars,
            provider,
          })
          .catch((err) => {
            // No queremos que un error de DB en el tracking afecte la
            // experiencia del user — logueamos y seguimos.
            this.logger.warn(
              `Failed to record token usage for user=${userId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          });
      }
    }
  }
}
