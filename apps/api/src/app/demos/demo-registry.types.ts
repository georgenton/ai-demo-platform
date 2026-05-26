// -----------------------------------------------------------------------------
// Tipos del catálogo de demos.
//
// Vive en un archivo aparte (no junto al service) porque son tipos puros sin
// runtime — los consume el controller para tipar la respuesta HTTP, los
// tests para fabricar fixtures, y eventualmente el frontend (cuando exista
// un paquete @org/contracts) para evitar drift.
// -----------------------------------------------------------------------------

/**
 * Estado de cada demo desde el punto de vista del usuario final:
 *   - `available`: terminado y listo para presentar.
 *   - `coming-soon`: en roadmap o en construcción. Lo mostramos para que el
 *     cliente vea el plan, pero la UI lo deja deshabilitado.
 */
import { ApiProperty } from '@nestjs/swagger';

export type DemoStatus = 'available' | 'coming-soon';

/**
 * Metadata visible de un demo. NO incluye configuración técnica (prompt
 * builder, tamaño de chunk, etc.) — eso vive dentro del módulo de cada demo.
 * Acá solo va lo que la UI necesita para pintar la cartelera.
 */
export class DemoMetadata {
  @ApiProperty({
    description:
      'ID estable usado en URLs, filtros de pgvector y demoId del frontend.',
    example: 'rag',
  })
  id!: string;

  @ApiProperty({ example: 'Chat con documentos' })
  title!: string;

  @ApiProperty({
    description: 'Frase one-liner que vende el demo.',
    example: 'Chatea con el reglamento académico de tu universidad',
  })
  tagline!: string;

  @ApiProperty({
    description: '1–3 oraciones describiendo qué hace y cómo se usa.',
  })
  description!: string;

  @ApiProperty({
    description: 'Tipos de cliente para los que es relevante.',
    example: ['Universidades', 'RRHH', 'Áreas legales'],
    type: [String],
  })
  audience!: string[];

  @ApiProperty({
    enum: ['available', 'coming-soon'],
    description: 'Disponibilidad actual.',
  })
  status!: DemoStatus;

  @ApiProperty({ example: '/demo/rag' })
  route!: string;
}
