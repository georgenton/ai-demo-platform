// AgentModule — Demo 04 (Agente con tool use sobre SQL).
//
// SafeSqlExecutor sí tiene @Injectable() (es una clase del backend, no de un
// package compartido), así que va como provider plano. AgentService lo recibe
// por DI.

import { Module } from '@nestjs/common';

import { SqlGenerationModule } from '../sql-generation/sql-generation.module.js';

import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { SafeSqlExecutor } from './safe-sql-executor.js';

@Module({
  imports: [SqlGenerationModule],
  controllers: [AgentController],
  providers: [AgentService, SafeSqlExecutor],
})
export class AgentModule {}
