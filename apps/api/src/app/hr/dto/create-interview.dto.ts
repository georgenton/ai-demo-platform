// -----------------------------------------------------------------------------
// Body del POST /api/v1/hr/interviews.
//
// El reclutador (usuario del sistema) elige un rol del catálogo y registra
// el nombre del candidato + opcionalmente su cédula. El backend crea la
// Interview en el tenant del reclutador y devuelve interviewId + la primera
// pregunta para arrancar la sesión inmediatamente (un round-trip menos en
// el frontend).
//
// `candidateName` es entrada libre — el reclutador escribe el nombre como
// quiera (algunos prefieren iniciales por privacidad). `candidateExternalId`
// suele ser la cédula ecuatoriana (10 dígitos) pero lo dejamos string para
// no acoplarnos a un país. Validamos solo que no sea ridículamente largo.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty({
    description:
      'cuid del rol (Job) del catálogo seedeado. El backend lo busca en el ' +
      'tenant compartido "hr-shared"; si no existe, 404.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  jobId!: string;

  @ApiProperty({
    description:
      'Nombre del candidato. Entrada libre del reclutador — puede ser nombre ' +
      'completo, iniciales para privacidad, o un identificador interno.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  candidateName!: string;

  @ApiProperty({
    required: false,
    description:
      'Identificador externo del candidato (típicamente cédula). Opcional; el ' +
      'reclutador lo agrega si quiere cruzar con su ATS interno.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  candidateExternalId?: string;
}
