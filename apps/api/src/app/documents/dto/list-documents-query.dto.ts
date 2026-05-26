// Query string del endpoint GET /api/v1/documents.
//
// Todos los valores llegan como string desde el query; el ValidationPipe
// global tiene `transform: true`, así que con @Type(Number) convierte limit
// y offset a number antes de validar.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtra por demo. Si se omite, devuelve docs de todos los demos.',
    example: 'rag',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  demoId?: string;

  @ApiPropertyOptional({
    description: 'Máximo de filas. Default 20, tope 100.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cuántas filas saltear (paginación).',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
