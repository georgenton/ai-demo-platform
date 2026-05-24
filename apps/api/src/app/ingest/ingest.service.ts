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

  async ingest(input: IngestRequestDto): Promise<IngestResponseDto> {
    this.logger.log(
      `Ingesting "${input.name}" for demo "${input.demoId}" (${input.content.length} chars)`,
    );

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
    //    (HTTP a OpenAI) y no tiene sentido mantener una connection de la DB
    //    bloqueada mientras esperamos al LLM provider.
    const vectors = await this.embeddings.embedMany(chunks);

    // 3) + 4) Atomicidad real con una interactive transaction. Si algo dentro
    //    del callback falla, Prisma rollbackea TODO automáticamente —
    //    incluyendo el Document que ya hubiéramos creado. Sin esto antes
    //    teníamos un compensating-action manual; ahora la atomicidad la da
    //    el motor de la DB.
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          name: input.name,
          content: input.content,
          demoId: input.demoId,
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
      `Ingested "${input.name}" → documentId=${result.documentId}, chunks=${result.chunkCount}`,
    );

    return result;
  }
}
