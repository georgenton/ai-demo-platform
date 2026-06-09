// -----------------------------------------------------------------------------
// IngestService — orquesta el pipeline de ingesta de un documento:
//   1) Chunkear el texto                           (Chunker)
//   2) Generar embeddings para cada chunk         (EmbeddingService)
//   3) Crear el Document en la DB                 (prisma)
//   4) Guardar los chunks con sus embeddings      (VectorStore)
//
// Las tres dependencias del RAG (chunker, embeddings, vectorStore) se reciben
// por constructor — vienen del DI de NestJS (registradas como providers en
// IngestModule). Eso permite mockearlas en tests.
//
// `prisma` se importa directo de @org/db porque ya es un singleton; envolverlo
// en DI sería ceremonia sin valor (lo mockeamos vía vi.mock en tests).
// -----------------------------------------------------------------------------

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';
import {
  embeddingsInfoFor,
  resolveEmbeddingsProvider,
  type ChatProvider,
  type EmbeddingsProvider,
} from '@org/llm-adapter';
import {
  EmbeddingService,
  SlidingWindowChunker,
  VectorStore,
} from '@org/rag-core';

import type { IngestRequestDto, IngestResponseDto } from './dto/ingest.dto.js';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly chunker: SlidingWindowChunker,
    private readonly embeddings: EmbeddingService,
    private readonly vectorStore: VectorStore,
  ) {}

  /**
   * Indexa un documento: chunking → embeddings → vector store. Acepta un
   * `llmProvider` opcional para respetar el dropdown del header del frontend.
   *
   * Si `llmProvider === 'anthropic'`, rechaza con 400: Anthropic no fabrica
   * embeddings y el ADR-0018 decidió no sumar un tercer proveedor cloud
   * solo para esto. El usuario debe cambiar al provider on-prem.
   */
  async ingest(
    input: IngestRequestDto,
    tenantId: string,
    llmProvider?: ChatProvider,
  ): Promise<IngestResponseDto> {
    this.logger.log(
      `Ingesting "${input.name}" for tenant=${tenantId} demo=${input.demoId} ` +
        `(${input.content.length} chars, llmProvider=${llmProvider ?? 'env default'})`,
    );

    // 0) Resolver el provider de embeddings desde el llmProvider activo. Si
    //    el chat provider activo es 'anthropic', resolveEmbeddingsProvider
    //    devuelve null (Anthropic no tiene API de embeddings) y rechazamos
    //    el ingest con un mensaje claro. ADR-0018 explica el porqué.
    let embeddingsProvider: EmbeddingsProvider | undefined;
    if (llmProvider) {
      const mapped = resolveEmbeddingsProvider(llmProvider);
      if (mapped === null) {
        throw new BadRequestException(
          'El proveedor "Anthropic API" no soporta embeddings. ' +
            'Cambia al modelo "NAI on-prem" en el header para indexar documentos. ' +
            'Ver ADR-0018.',
        );
      }
      embeddingsProvider = mapped;
    }

    // 1) Chunkear. Si el chunker devuelve 0, el contenido no tenía nada útil
    //    (solo whitespace, o demasiado corto). 400 al usuario, no 500.
    const chunks = this.chunker.split(input.content);
    if (chunks.length === 0) {
      throw new BadRequestException(
        'El contenido no produjo ningún chunk. ¿Está vacío o solo tiene espacios?',
      );
    }
    this.logger.log(`Split into ${chunks.length} chunks`);

    // 2) Embeddings — el EmbeddingService batchea internamente si hace falta.
    //    Lo hacemos ANTES de abrir la transacción: es la operación lenta
    //    (HTTP al LLM provider) y no tiene sentido mantener una connection
    //    de la DB bloqueada mientras esperamos.
    //
    //    Pasamos el provider override para respetar el dropdown del header.
    //    Si embeddingsProvider es undefined, el adapter cae al singleton del
    //    env (retrocompat 100%).
    const embedOpts = embeddingsProvider
      ? { provider: embeddingsProvider }
      : undefined;
    const vectors = await this.embeddings.embedMany(chunks, embedOpts);

    // 2.5) Resolver metadata del provider para popular Document.embeddings*.
    //      embeddingsInfoFor lee el modelo del env + dim configurada → la
    //      misma info viaja con el Document para que la búsqueda RAG pueda
    //      filtrar y nunca cruzar espacios vectoriales (ver ADR-0018).
    const info = embeddingsInfoFor(
      embeddingsProvider ??
        // Si no hay override, leemos el provider del env igual. La función
        // de abajo lanza si EMBEDDINGS_PROVIDER no está; eso ya pasaría
        // antes en embedMany, así que llegar acá implica que está OK.
        (process.env.EMBEDDINGS_PROVIDER as
          | 'openai'
          | 'openai-compat'
          | 'private-mac'
          | 'fake'),
    );

    // 3) + 4) Atomicidad real con una interactive transaction. Si algo dentro
    //    del callback falla, Prisma rollbackea TODO automáticamente —
    //    incluyendo el Document que ya hubiéramos creado.
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          name: input.name,
          content: input.content,
          demoId: input.demoId,
          tenantId,
          // Metadata del espacio vectorial — para que la búsqueda RAG sepa
          // con qué provider/modelo fue indexado este doc y solo lo retorne
          // cuando se consulta con un vector del mismo espacio.
          embeddingsProvider: info.provider,
          embeddingsModel: info.model,
          embeddingsDim: info.dim,
        },
      });

      // VectorStore es tx-aware: cuando le pasamos el cliente transaccional,
      // los INSERTs viajan dentro del mismo `tx` que el Document.create.
      await this.vectorStore.saveChunks(
        document.id,
        chunks.map((content, index) => ({
          content,
          index,
          embedding: vectors[index],
        })),
        tx,
      );

      return {
        documentId: document.id,
        chunkCount: chunks.length,
      };
    });

    this.logger.log(
      `Ingested "${input.name}" → documentId=${result.documentId}, ` +
        `chunks=${result.chunkCount}, embeddings=${info.provider}/${info.model} (${info.dim}d)`,
    );

    return result;
  }
}
