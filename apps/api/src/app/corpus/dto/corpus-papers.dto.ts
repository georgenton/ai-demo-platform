// -----------------------------------------------------------------------------
// DTOs del listado paginado de papers del corpus.
//
// Cada item trae los campos de Document + array de topics ya joineados.
// Sin abstract por default — es grande y la lista se renderiza compacta.
// Para ver un paper en detalle, usar GET /api/v1/documents/:id (que ya
// existe del Demo 01).
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CorpusPapersQueryDto {
  @ApiProperty({
    description: 'Cantidad de papers a devolver. Default 20, máx 100.',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Offset para paginación. Default 0.',
    required: false,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CorpusPaperItemDto {
  @ApiProperty({
    description: 'ID del Document',
    example: 'cmpoq1abc0000xxxxxxxx',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre del archivo PDF original',
    example: 'tesis-machine-learning-2023.pdf',
  })
  name!: string;

  @ApiProperty({
    description: 'Año de publicación si el LLM lo extrajo',
    nullable: true,
    example: 2023,
  })
  year!: number | null;

  @ApiProperty({
    description: 'Autores',
    type: [String],
    example: ['Jorge Pérez'],
  })
  authors!: string[];

  @ApiProperty({
    description: 'Tópicos extraídos por LLM',
    type: [String],
    example: ['educación', 'machine learning'],
  })
  topics!: string[];

  @ApiProperty({
    description: 'Fecha de ingest',
    example: '2026-05-28T17:30:00.000Z',
  })
  createdAt!: string;
}

export class CorpusPapersResponseDto {
  @ApiProperty({ type: [CorpusPaperItemDto] })
  items!: CorpusPaperItemDto[];

  @ApiProperty({ description: 'Total de papers en el corpus' })
  total!: number;

  @ApiProperty({ description: 'limit usado' })
  limit!: number;

  @ApiProperty({ description: 'offset usado' })
  offset!: number;
}
