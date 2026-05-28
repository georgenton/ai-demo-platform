// -----------------------------------------------------------------------------
// DTOs del endpoint POST /api/v1/corpus/upload.
//
// El frontend del Demo 03 puede subir uno o varios PDFs en una sola request.
// El servicio procesa cada uno: extract → metadata LLM → chunks/embeddings.
// La respuesta es la lista de Documents creados (uno por archivo).
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';

/**
 * Body multipart del upload de corpus. El campo `files[]` se procesa con
 * `FilesInterceptor` (plural — admite múltiples archivos por vez). Si solo
 * mandás uno, también funciona.
 */
export class CorpusUploadBodyDto {
  // El campo `files[]` se valida en el controller con ParseFilePipeBuilder,
  // no acá — class-validator no puede inspeccionar el File de Multer.
}

/**
 * Lo que devolvemos por cada paper procesado exitosamente.
 */
export class CorpusUploadItemDto {
  @ApiProperty({
    description: 'ID del Document creado',
    example: 'cmpoq1abc0000xxxxxxxx',
  })
  documentId!: string;

  @ApiProperty({
    description: 'Nombre original del archivo',
    example: 'tesis-machine-learning-2023.pdf',
  })
  name!: string;

  @ApiProperty({
    description: 'Título extraído por el LLM (puede diferir del filename)',
    example: 'Aplicación de Machine Learning en la educación superior',
  })
  title!: string;

  @ApiProperty({
    description: 'Año de publicación si el LLM lo encontró',
    nullable: true,
    example: 2023,
  })
  year!: number | null;

  @ApiProperty({
    description: 'Autores extraídos',
    type: [String],
    example: ['Jorge Pérez', 'María González'],
  })
  authors!: string[];

  @ApiProperty({
    description: 'Tópicos extraídos por el LLM',
    type: [String],
    example: ['educación', 'machine learning', 'inteligencia artificial'],
  })
  topics!: string[];

  @ApiProperty({
    description: 'Cantidad de chunks generados e indexados en pgvector',
    example: 42,
  })
  chunkCount!: number;
}

/**
 * Respuesta del endpoint con la lista de items procesados + tally de éxitos.
 */
export class CorpusUploadResponseDto {
  @ApiProperty({ type: [CorpusUploadItemDto] })
  items!: CorpusUploadItemDto[];

  @ApiProperty({
    description: 'Cantidad total de papers procesados exitosamente',
    example: 5,
  })
  successCount!: number;

  @ApiProperty({
    description:
      'Cantidad de papers que fallaron (PDF sin texto, LLM falló, etc.). Los errores se loggean server-side, no se devuelven al cliente para no exponer detalles internos.',
    example: 0,
  })
  failureCount!: number;
}
