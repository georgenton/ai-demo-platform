// -----------------------------------------------------------------------------
// Forma de las respuestas del módulo Documents.
//
// Tres views distintas según el endpoint:
//
//   DocumentSummary:  para la lista. NO incluye `content` (puede ser 100KB
//                     por doc; mandar 50 en un GET de listado sería absurdo).
//   DocumentDetail:   para GET /:id. Incluye `content` completo.
//   ChunkSummary:     para GET /:id/chunks. NO incluye el embedding vector
//                     (768 floats por chunk = ruido para la UI).
//
// Son interfaces (no clases) — no van por el ValidationPipe (son outputs,
// no inputs). El compilador asegura que el service devuelve la forma correcta.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';

export class DocumentSummary {
  @ApiProperty({ example: 'clxyz1234567890' })
  id!: string;

  @ApiProperty({ example: 'reglamento.pdf' })
  name!: string;

  @ApiProperty({ example: 'rag' })
  demoId!: string;

  @ApiProperty({
    description: 'ISO-8601 string.',
    example: '2026-01-15T18:23:45.123Z',
  })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-15T18:23:45.123Z' })
  updatedAt!: string;

  @ApiProperty({
    description:
      'Cantidad de chunks asociados — útil para la UI sin pedir el detalle.',
    example: 12,
  })
  chunkCount!: number;
}

export class DocumentDetail extends DocumentSummary {
  @ApiProperty({
    description: 'Texto completo extraído del documento (puede ser grande).',
  })
  content!: string;
}

export class ListDocumentsResponse {
  @ApiProperty({ type: [DocumentSummary] })
  items!: DocumentSummary[];

  @ApiProperty({
    description:
      'Total de filas que matchean el filtro (no el largo de `items`).',
    example: 42,
  })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class ChunkSummary {
  @ApiProperty({ example: 'clchk1234567890' })
  id!: string;

  @ApiProperty({
    example: 0,
    description: 'Posición del chunk en el documento.',
  })
  index!: number;

  @ApiProperty({ example: 'Artículo 1. La presente reglamentación...' })
  content!: string;
}
