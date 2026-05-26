// -----------------------------------------------------------------------------
// DemosModule — agrupa el controller y el service del catálogo de demos.
//
// Exporta el service para que otros módulos (ChatModule, IngestModule)
// puedan consultarlo si en el futuro necesitan validar demoId contra el
// catálogo en vez de aceptar cualquier string. Por ahora nadie lo consume
// más allá del controller, pero exportarlo es trivial y deja la puerta
// abierta.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { DemoRegistryService } from './demo-registry.service.js';
import { DemosController } from './demos.controller.js';

@Module({
  controllers: [DemosController],
  providers: [DemoRegistryService],
  exports: [DemoRegistryService],
})
export class DemosModule {}
