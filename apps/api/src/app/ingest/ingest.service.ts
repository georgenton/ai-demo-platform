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
    const vectors = await this.embeddings.embedMany(chunks);

    // 3) Crear el Document.
    const document = await prisma.document.create({
      data: {
        name: input.name,
        content: input.content,
        demoId: input.demoId,
      },
    });

    // 4) Guardar los chunks. Si falla, hacemos rollback del Document para no
    //    dejar huérfanos. (No es transacción total porque VectorStore aún no
    //    es tx-aware; lo refinaremos en otro PR. Compensation por ahora.)
    try {
      await this.vectorStore.saveChunks(
        document.id,
        chunks.map((content, index) => ({
          content,
          index,
          embedding: vectors[index],
        })),
      );
    } catch (err) {
      this.logger.error(
        `saveChunks falló para "${input.name}"; haciendo rollback del Document ${document.id}`,
        err,
      );
      await prisma.document.delete({ where: { id: document.id } });
      throw err;
    }

    this.logger.log(
      `Ingested "${input.name}" → documentId=${document.id}, chunks=${chunks.length}`,
    );

    return {
      documentId: document.id,
      chunkCount: chunks.length,
    };
  }
}
