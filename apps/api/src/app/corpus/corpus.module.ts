// -----------------------------------------------------------------------------
// CorpusModule — Demo 03 (Corpus académico).
//
// Importa IngestModule para poder inyectar IngestService y PdfTextExtractor
// (los providers están exportados desde IngestModule — ver su `exports` array).
//
// Si en el futuro Corpus crece con sub-features (search, summary, stats), se
// agregan acá como controllers/services del mismo módulo.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { IngestModule } from '../ingest/ingest.module.js';

import { CorpusController } from './corpus.controller.js';
import { CorpusIngestService } from './corpus-ingest.service.js';

@Module({
  imports: [IngestModule],
  controllers: [CorpusController],
  providers: [CorpusIngestService],
})
export class CorpusModule {}
