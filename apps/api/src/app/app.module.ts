import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './agent/agent.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CompareModule } from './compare/compare.module.js';
import { validateEnv } from './config/env.schema.js';
import { CorpusModule } from './corpus/corpus.module.js';
import { DemosModule } from './demos/demos.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthModule } from './health/health.module.js';
import { IngestModule } from './ingest/ingest.module.js';

@Module({
  imports: [
    // ConfigModule global: lee `.env` automáticamente (si existe) y valida
    // las variables con el schema. Si algo falta o es inválido, el server
    // NO arranca — falla rápida con mensaje claro.
    //
    // `isGlobal: true` evita tener que importar ConfigModule en cada módulo
    // hijo que quiera leer config.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // `.env` lo carga por defecto si existe; en CI/prod las vars vienen
      // del entorno directamente y eso también funciona.
    }),
    AgentModule,
    ChatModule,
    CompareModule,
    CorpusModule,
    DemosModule,
    DocumentsModule,
    HealthModule,
    IngestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
