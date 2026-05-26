// CompareModule — el módulo de Demo 02.
//
// ComparePromptBuilder no tiene @Injectable() (vive co-localizado, sin
// dependencia de NestJS), así que lo registramos con useFactory — mismo
// patrón que ChatModule/IngestModule con los providers de @org/rag-core.

import { Module } from '@nestjs/common';

import { ComparePromptBuilder } from './compare-prompt-builder.js';
import { CompareController } from './compare.controller.js';
import { CompareService } from './compare.service.js';

@Module({
  controllers: [CompareController],
  providers: [
    CompareService,
    {
      provide: ComparePromptBuilder,
      useFactory: (): ComparePromptBuilder => new ComparePromptBuilder(),
    },
  ],
})
export class CompareModule {}
