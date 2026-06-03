// -----------------------------------------------------------------------------
// Query del GET /api/v1/clinical/protocols.
//
// El frontend muestra los protocolos clínicos en una grilla, con filtro por
// categoría. Las categorías del seed actual son:
//   - cardiologia
//   - urgencias
//   - medicina-interna
//   - pediatria
//   - atencion-primaria
//
// Se valida como string libre (no enum) para que agregar una categoría futura
// no requiera tocar el DTO ni perder requests por validación estricta. El
// service hace el lookup; si no hay matches, devuelve lista vacía (no 400).
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListProtocolsQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Categoría exacta (ej. "cardiologia"). Si se omite, devuelve TODOS los ' +
      'protocolos agrupados por categoría en el frontend.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
