// DTOs del endpoint /api/v1/ingest.
// class-validator se ejecuta automáticamente vía el ValidationPipe global
// (ver main.ts). Si el body no cumple, NestJS responde 400 con detalle.

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestRequestDto {
  /** Nombre del archivo o título del documento (lo mostramos en la UI). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** Texto completo extraído del documento (PDF/Word/etc.). */
  @IsString()
  @IsNotEmpty()
  content!: string;

  /** Identificador del demo al que pertenece este documento: 'rag', 'comparator', etc. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  demoId!: string;
}

export interface IngestResponseDto {
  documentId: string;
  chunkCount: number;
}
