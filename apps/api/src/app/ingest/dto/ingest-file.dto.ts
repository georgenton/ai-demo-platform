// DTO del body del endpoint multipart /api/v1/ingest/file.
//
// El archivo viaja por separado (multipart `file` field, lo agarra
// @UploadedFile), así que el body solo lleva el resto: por ahora demoId.

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestFileBodyDto {
  /** Identificador del demo: 'rag', 'comparator', etc. (igual que en JSON ingest). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  demoId!: string;
}
