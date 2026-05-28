// -----------------------------------------------------------------------------
// IngestModule — registra el controller, los services y los providers de
// rag-core que se inyectan en IngestService.
//
// Las clases de @org/rag-core no tienen el decorador @Injectable() (no
// queremos acoplar el package a NestJS). Por eso las registramos con
// `useFactory` — Nest crea la instancia llamando a la factory y la inyecta
// donde corresponde por su tipo.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import {
  EmbeddingService,
  SlidingWindowChunker,
  VectorStore,
} from '@org/rag-core';

import { IngestController } from './ingest.controller.js';
import { IngestService } from './ingest.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';

@Module({
  controllers: [IngestController],
  providers: [
    IngestService,
    PdfTextExtractor,
    {
      // Defaults razonables para PDFs institucionales. Si más adelante
      // queremos demos con tamaños distintos, se inyecta por configuración.
      provide: SlidingWindowChunker,
      useFactory: (): SlidingWindowChunker =>
        new SlidingWindowChunker({ size: 800, overlap: 100 }),
    },
    {
      provide: EmbeddingService,
      useFactory: (): EmbeddingService => new EmbeddingService(),
    },
    {
      provide: VectorStore,
      useFactory: (): VectorStore => new VectorStore(),
    },
  ],
  // CorpusModule (Demo 03) reusa la maquinaria de ingest para procesar
  // papers académicos antes de extraerles metadata via LLM. Exportamos
  // IngestService y PdfTextExtractor para que sean inyectables ahí.
  exports: [IngestService, PdfTextExtractor],
})
export class IngestModule {}
