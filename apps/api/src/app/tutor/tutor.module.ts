// -----------------------------------------------------------------------------
// TutorModule — Demo 05 (tutor de inglés + cost calculator).
//
// Sin DB. Sin estado. Cada request del chat es independiente; el historial
// viaja en el body y el cost engine es pure math en el frontend. Por eso
// no hay providers extra ni dependencias entre módulos.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { TutorController } from './tutor.controller.js';
import { TutorService } from './tutor.service.js';

@Module({
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
