import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestModule } from './ingest/ingest.module.js';

@Module({
  imports: [IngestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
