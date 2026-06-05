import { Module } from '@nestjs/common';

import { PrivateLlmController } from './private-llm.controller.js';

@Module({
  controllers: [PrivateLlmController],
})
export class PrivateLlmModule {}
