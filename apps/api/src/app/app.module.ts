import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module.js';
import { AgentModule } from './agent/agent.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { BiModule } from './bi/bi.module.js';
import { ClinicalModule } from './clinical/clinical.module.js';
import { CompareModule } from './compare/compare.module.js';
import { validateEnv } from './config/env.schema.js';
import { CorpusModule } from './corpus/corpus.module.js';
import { DemosModule } from './demos/demos.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthModule } from './health/health.module.js';
import { HrModule } from './hr/hr.module.js';
import { IndustryModule } from './industries/industry.module.js';
import { IngestModule } from './ingest/ingest.module.js';
import { LoansModule } from './loans/loans.module.js';
import { MeModule } from './me/me.module.js';
import { NotarizeModule } from './notarize/notarize.module.js';
import { PrivateLlmModule } from './private-llm/private-llm.module.js';
import { TokenQuotaGuard } from './quota/token-quota.guard.js';
import { TokenQuotaModule } from './quota/token-quota.module.js';
import { TutorModule } from './tutor/tutor.module.js';
import { APP_GUARD } from '@nestjs/core';

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
    AdminModule,
    AgentModule,
    AuthModule,
    BiModule,
    ChatModule,
    ClinicalModule,
    CompareModule,
    CorpusModule,
    DemosModule,
    DocumentsModule,
    HealthModule,
    HrModule,
    IndustryModule,
    IngestModule,
    LoansModule,
    MeModule,
    NotarizeModule,
    PrivateLlmModule,
    TokenQuotaModule,
    TutorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global del rate limit. Hace pre-check de quota a TODOS los
    // requests autenticados (endpoints @Public() y superadmin pasan
    // derecho). Si el user excedió 20k tokens/hora, devuelve 429 antes
    // de tocar el LLM. El record del usage lo hacen los servicios después
    // de la llamada al LLM via TokenQuotaService.recordUsage().
    {
      provide: APP_GUARD,
      useClass: TokenQuotaGuard,
    },
  ],
})
export class AppModule {}
