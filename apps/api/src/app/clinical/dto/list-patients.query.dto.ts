// -----------------------------------------------------------------------------
// Query string del GET /api/v1/clinical/patients.
//
// Endpoint pensado para alimentar el panel izquierdo del demo: el médico
// escribe en un input y el panel filtra la lista. Búsqueda case-insensitive
// sobre `displayName` (se compara en el service con `mode: 'insensitive'`).
//
// Decisiones intencionales:
//   - `search` opcional, sin search ⇒ lista completa.
//   - `limit` topado a 200 — el dataset entero del tenant compartido son 30
//     pacientes; el cap es para futuros tenants reales que puedan tener miles.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPatientsQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Texto a buscar en displayName del paciente. Case-insensitive. ' +
      'Si se omite, devuelve la lista completa hasta `limit`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiProperty({
    required: false,
    default: 50,
    description: 'Cantidad máxima de resultados. Entre 1 y 200.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
