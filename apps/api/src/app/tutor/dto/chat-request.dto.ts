// -----------------------------------------------------------------------------
// DTO del POST /api/v1/tutor/chat.
//
// El frontend envía el historial completo de la conversación + el último
// mensaje del usuario + nivel + escenario. El server arma el system prompt
// según level/scenario y llama al LLM.
//
// Por qué el cliente manda el historial (en vez de guardarlo server-side):
//   - Sesión 100% en el cliente. Cero estado en el backend → puede escalar
//     horizontal sin sticky sessions.
//   - El usuario puede "limpiar conversación" sin coordinar con el server.
//   - El cost calculator del demo necesita ver la conversación entera para
//     proyectar tokens; mandar el history hace explícito qué se está
//     facturando.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Niveles soportados por el tutor. Espejo de `TutorLevel` en persona/. */
export const TUTOR_LEVELS = ['A2', 'B1', 'B2'] as const;
export type TutorLevel = (typeof TUTOR_LEVELS)[number];

/** Escenarios soportados. Espejo de `TutorScenario` en persona/. */
export const TUTOR_SCENARIOS = ['general', 'cafe', 'interview'] as const;
export type TutorScenario = (typeof TUTOR_SCENARIOS)[number];

/**
 * Un turn previo de la conversación. Solo permitimos roles 'user' y
 * 'assistant' — 'system' lo arma el server desde level/scenario, no el
 * cliente (sería inyección de prompt).
 */
export class TutorHistoryTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ description: 'Texto del turno.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

export class TutorChatRequestDto {
  @ApiProperty({
    type: [TutorHistoryTurnDto],
    description:
      'Conversación previa. Puede estar vacía si es el primer mensaje. ' +
      'Máximo 40 turns (≈ 20 vueltas) para acotar el costo por request.',
  })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TutorHistoryTurnDto)
  history!: TutorHistoryTurnDto[];

  @ApiProperty({
    description: 'Último mensaje del usuario — el que el LLM debe responder.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({
    enum: TUTOR_LEVELS,
    description: 'CEFR target — define cuán simple/complejo responde el tutor.',
  })
  @IsEnum(TUTOR_LEVELS)
  level!: TutorLevel;

  @ApiProperty({
    enum: TUTOR_SCENARIOS,
    description:
      'Escenario de role-play. "general" = small-talk; "cafe" = ordenar; ' +
      '"interview" = entrevista de trabajo simulada.',
    required: false,
    default: 'general',
  })
  @IsOptional()
  @IsEnum(TUTOR_SCENARIOS)
  scenario?: TutorScenario;
}
