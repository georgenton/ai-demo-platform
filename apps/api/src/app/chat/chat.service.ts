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

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import {
  chat,
  embeddingsInfoFor,
  resolveEmbeddingsProvider,
} from '@org/llm-adapter';
import type { ChatProvider, EmbeddingsProvider } from '@org/llm-adapter';
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

  /**
   * Orquesta una pregunta RAG end-to-end: embed → retrieval filtrado por
   * espacio vectorial → prompt → streaming.
   *
   * Si `llmProvider === 'anthropic'`, rechaza con 400 ANTES de hacer
   * trabajo: Anthropic no tiene embeddings, así que no podríamos hacer
   * retrieval — y RAG sin retrieval no es RAG. ADR-0018 documenta la
   * decisión de no sumar un tercer proveedor cloud para esto.
   */
  async *streamChat(
    query: ChatQueryDto,
    tenantId: string,
    llmProvider?: ChatProvider,
  ): AsyncIterable<string> {
    this.logger.log(
      `Chat for tenant=${tenantId} demo=${query.demoId}: "${query.q}" ` +
        `(topK=${query.topK ?? DEFAULT_TOP_K}, llmProvider=${llmProvider ?? 'env default'})`,
    );

    // 0) Resolver embeddings provider desde el chat provider activo. Si el
    //    user eligió Anthropic en el dropdown, rechazamos acá con 400 —
    //    Anthropic no fabrica embeddings y el resto del flujo no tiene
    //    sentido. Ver ADR-0018.
    let embeddingsProvider: EmbeddingsProvider | undefined;
    if (llmProvider) {
      const mapped = resolveEmbeddingsProvider(llmProvider);
      if (mapped === null) {
        throw new BadRequestException(
          'El demo RAG requiere embeddings, y el proveedor "Anthropic API" ' +
            'no los ofrece. Cambia al modelo "NAI on-prem" en el header para ' +
            'preguntar sobre tus documentos. Ver ADR-0018.',
        );
      }
      embeddingsProvider = mapped;
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

    // 4) Streaming del LLM — yield de cada token cuesta abajo. yield* delega
    //    al AsyncIterable del adapter sin envolverlo, así no pagamos overhead.
    yield* chat.completeStream(messages, { provider: llmProvider });
  }
}
