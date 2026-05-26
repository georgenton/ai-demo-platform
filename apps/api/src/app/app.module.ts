import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './agent/agent.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CompareModule } from './compare/compare.module.js';
import { DemosModule } from './demos/demos.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { IngestModule } from './ingest/ingest.module.js';

@Module({
  imports: [
    AgentModule,
    ChatModule,
    CompareModule,
    DemosModule,
    DocumentsModule,
    IngestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
