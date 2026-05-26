// DTO del body del endpoint multipart /api/v1/ingest/file.
//
// El archivo viaja por separado (multipart `file` field, lo agarra
// @UploadedFile), así que el body solo lleva el resto: por ahora demoId.

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestFileBodyDto {
  @ApiProperty({
    description:
      'Identificador del demo al que pertenece el archivo (igual que en /ingest JSON).',
    example: 'rag',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  demoId!: string;
}
