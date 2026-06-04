// -----------------------------------------------------------------------------
// Body del POST /api/v1/hr/interviews/:id/answer.
//
// El frontend manda la transcripción literal de lo que el candidato dijo a
// la pregunta indicada. Si el candidato vuelve a grabar antes de confirmar,
// el upsert pisa el transcript anterior — solo queda el último (decisión
// del esquema: `@@unique([interviewId, questionId])`).
//
// `durationSeconds` es opcional; el frontend lo mide del start/stop del mic.
// Útil para auditar respuestas sospechosamente cortas o larguísimas, pero
// no crítico — si no llega, se persiste null.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AnswerQuestionDto {
  @ApiProperty({
    description:
      'cuid de la JobQuestion que el candidato está respondiendo. Debe ' +
      'pertenecer al Job de la Interview o 400.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  questionId!: string;

  @ApiProperty({
    description:
      'Transcripción literal de la respuesta. La emite el reconocedor de ' +
      'voz del browser; el reclutador la puede editar antes de confirmar.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000) // 8000 chars ≈ 1300 palabras, holgado para 2-3 min de habla.
  transcript!: string;

  @ApiProperty({
    required: false,
    description:
      'Duración de la respuesta en segundos (medida del mic on/off del browser). ' +
      'Útil para auditar; null si no se midió.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 30) // 30 minutos como tope sanity.
  durationSeconds?: number;
}
