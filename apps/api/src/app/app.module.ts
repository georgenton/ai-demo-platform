import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module.js';
import { DemosModule } from './demos/demos.module.js';
import { IngestModule } from './ingest/ingest.module.js';

@Module({
  imports: [ChatModule, DemosModule, IngestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
