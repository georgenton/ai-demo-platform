// DTO del query del endpoint POST /api/v1/agent.
//
// El body es JSON estructurado (pregunta + demoId), no query string.
// El ValidationPipe global enforces estos decoradores antes de tocar el agente.

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AgentQueryDto {
  /** Pregunta en lenguaje natural. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q!: string;

  /**
   * Demo del que viene la pregunta. Hoy solo 'agent' tiene sentido — los
   * otros demos no usan tool use. Lo dejamos opcional por simetría con el
   * resto del API.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  demoId?: string;
}
