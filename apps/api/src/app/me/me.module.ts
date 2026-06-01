// -----------------------------------------------------------------------------
// MeModule — solo el MeController. Consume IndustryService y
// DemoRegistryService de sus respectivos módulos.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { DemosModule } from '../demos/demos.module.js';
import { IndustryModule } from '../industries/industry.module.js';

import { MeController } from './me.controller.js';

@Module({
  imports: [IndustryModule, DemosModule],
  controllers: [MeController],
})
export class MeModule {}
