// -----------------------------------------------------------------------------
// ClinicalModule — Demo 06 (asistente clínico).
//
// Sin providers extra: usa prisma directamente desde @org/db y el LLM via
// chat de @org/llm-adapter (igual que TutorModule). El gating por demo lo
// hace el DemoAccessGuard global vía `@RequireDemo('clinical')` en el
// controller.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { ClinicalController } from './clinical.controller.js';
import { ClinicalService } from './clinical.service.js';

@Module({
  controllers: [ClinicalController],
  providers: [ClinicalService],
})
export class ClinicalModule {}
