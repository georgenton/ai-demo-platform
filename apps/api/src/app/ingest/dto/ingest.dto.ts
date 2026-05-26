// DTOs del endpoint /api/v1/ingest.
// class-validator se ejecuta automáticamente vía el ValidationPipe global
// (ver main.ts). Si el body no cumple, NestJS responde 400 con detalle.
//
// Los decoradores @ApiProperty alimentan el spec OpenAPI (Bloque D); no
// afectan runtime.

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestRequestDto {
  @ApiProperty({
    description:
      'Nombre o título del documento (lo mostramos en la UI y se persiste en Document.name).',
    example: 'reglamento-academico-2025.pdf',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Texto completo extraído del documento (PDF/Word/etc.).',
    example: 'Capítulo 1: Disposiciones generales\n\nArtículo 1...',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description:
      'Identificador del demo al que pertenece este documento. Hoy: "rag", "comparator", "corpus", "agent".',
    example: 'rag',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  demoId!: string;
}

export class IngestResponseDto {
  @ApiProperty({
    description: 'ID del Document creado.',
    example: 'clxyz1234567890',
  })
  documentId!: string;

  @ApiProperty({
    description:
      'Cantidad de chunks generados y persistidos con sus embeddings.',
    example: 12,
  })
  chunkCount!: number;
}
