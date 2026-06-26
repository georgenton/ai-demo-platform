// -----------------------------------------------------------------------------
// BiModule — Demo 10 (Dashboard inteligente / BI dinámico).
//
// Wiring mínimo: BiController + BiService. La BD se accede vía el cliente
// prisma compartido de @org/db (importado dentro del service).
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { SqlGenerationModule } from '../sql-generation/sql-generation.module.js';

import { BiController } from './bi.controller.js';
import { BiService } from './bi.service.js';
import { BiDashboardService } from './dashboard.service.js';

@Module({
  imports: [SqlGenerationModule],
  controllers: [BiController],
  providers: [BiService, BiDashboardService],
})
export class BiModule {}
