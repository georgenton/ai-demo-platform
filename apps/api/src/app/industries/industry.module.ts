// -----------------------------------------------------------------------------
// IndustryModule — expone IndustryService al resto de la app.
//
// No tiene controllers propios: la única vía pública de consumir esto es
// el endpoint GET /api/v1/me/demos (MeModule). Otros módulos (DemoAccess
// guard, futuros admin endpoints) inyectan IndustryService directamente.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { IndustryService } from './industry.service.js';

@Module({
  providers: [IndustryService],
  exports: [IndustryService],
})
export class IndustryModule {}
