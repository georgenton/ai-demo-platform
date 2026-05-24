// -----------------------------------------------------------------------------
// ChatModule — el segundo módulo del Demo 01.
//
// Mismo patrón de DI que IngestModule: las clases de @org/rag-core no tienen
// @Injectable() (no acoplamos los packages a NestJS), así que las registramos
// con useFactory. Nest crea cada instancia llamando a la factory y la inyecta
// donde corresponde por tipo.
//
// IngestModule también registra EmbeddingService y VectorStore. Por ahora cada
// módulo tiene sus propias instancias — son stateless, no comparten estado, y
// la duplicación es marginal (~3 líneas por módulo). Si suma un tercer
// consumer, vale la pena extraer un RagCoreModule compartido.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { EmbeddingService, PromptBuilder, VectorStore } from '@org/rag-core';

import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: EmbeddingService,
      useFactory: (): EmbeddingService => new EmbeddingService(),
    },
    {
      provide: VectorStore,
      useFactory: (): VectorStore => new VectorStore(),
    },
    {
      provide: PromptBuilder,
      useFactory: (): PromptBuilder => new PromptBuilder(),
    },
  ],
})
export class ChatModule {}
