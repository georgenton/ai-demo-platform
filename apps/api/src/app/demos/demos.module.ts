// -----------------------------------------------------------------------------
// DemosModule — agrupa el controller y el service del catálogo de demos.
//
// Exporta el service para que otros módulos (ChatModule, IngestModule)
// puedan consultarlo si en el futuro necesitan validar demoId contra el
// catálogo en vez de aceptar cualquier string.
//
// Importa IndustryModule para que DemosController filtre el catálogo por
// los enabledDemos del tenant (PR-MT3 / ADR-0013).
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { IndustryModule } from '../industries/industry.module.js';

import { DemoRegistryService } from './demo-registry.service.js';
import { DemosController } from './demos.controller.js';

@Module({
  imports: [IndustryModule],
  controllers: [DemosController],
  providers: [DemoRegistryService],
  exports: [DemoRegistryService],
})
export class DemosModule {}
