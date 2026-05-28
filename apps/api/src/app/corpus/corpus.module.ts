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

import { ChatModule } from '../chat/chat.module.js';
import { IngestModule } from '../ingest/ingest.module.js';

import { CorpusController } from './corpus.controller.js';
import { CorpusIngestService } from './corpus-ingest.service.js';
import { CorpusStatsService } from './corpus-stats.service.js';
import { CorpusSummaryService } from './corpus-summary.service.js';

@Module({
  // ChatModule: exporta ChatService que reusamos para el search semántico
  //   sobre el corpus (mismo flujo RAG, solo cambia el filtro de demoId).
  // IngestModule: exporta IngestService + PdfTextExtractor que el ingest
  //   de corpus usa.
  imports: [ChatModule, IngestModule],
  controllers: [CorpusController],
  providers: [CorpusIngestService, CorpusStatsService, CorpusSummaryService],
})
export class CorpusModule {}
