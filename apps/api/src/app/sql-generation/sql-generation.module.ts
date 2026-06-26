// -----------------------------------------------------------------------------
// SqlGenerationModule — expone el SqlGenerationService para que BiModule y
// AgentModule lo inyecten cuando quieren pre-generar SQL con un modelo
// especializado.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { SqlGenerationService } from './sql-generation.service.js';

@Module({
  providers: [SqlGenerationService],
  exports: [SqlGenerationService],
})
export class SqlGenerationModule {}
