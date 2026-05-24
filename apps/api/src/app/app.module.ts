import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module.js';
import { IngestModule } from './ingest/ingest.module.js';

@Module({
  imports: [ChatModule, IngestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
