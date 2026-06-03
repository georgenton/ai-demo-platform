// -----------------------------------------------------------------------------
// AdminModule — agrupa el controller y service de administración del tenant.
// Importa DemosModule para que AdminService valide enabledDemos contra el
// registry en memoria.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { DemosModule } from '../demos/demos.module.js';

import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [DemosModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
