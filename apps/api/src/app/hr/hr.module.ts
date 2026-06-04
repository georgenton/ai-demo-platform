// -----------------------------------------------------------------------------
// HrModule — Demo 07 (avatar entrevistador HR).
//
// Sin providers extra: el service usa prisma directamente desde @org/db y
// el LLM via chat de @org/llm-adapter (mismo patrón que ClinicalModule y
// TutorModule). El gating por demo lo hace el DemoAccessGuard global vía
// `@RequireDemo('interview')` en el controller.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { HrController } from './hr.controller.js';
import { HrService } from './hr.service.js';

@Module({
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
