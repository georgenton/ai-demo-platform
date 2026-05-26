// Query string del endpoint GET /api/v1/documents.
//
// Todos los valores llegan como string desde el query; el ValidationPipe
// global tiene `transform: true`, así que con @Type(Number) convierte limit
// y offset a number antes de validar.

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
  /** Filtra por demo. Si se omite, devuelve documentos de todos los demos. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  demoId?: string;

  /**
   * Cantidad máxima de filas a devolver. Default 20 (vista típica de UI),
   * tope 100 (evita que un cliente accidental tire una lista enorme).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Cuántas filas saltear desde el principio. Para paginación. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
