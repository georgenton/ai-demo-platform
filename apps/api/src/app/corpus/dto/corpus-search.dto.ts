// -----------------------------------------------------------------------------
// DTO del endpoint GET /api/v1/corpus/search.
//
// Solo aceptamos `q` y `topK` opcional. `demoId` lo hardcodeamos en el
// controller a 'corpus' — no queremos que el cliente pueda apuntar el
// search a documentos de otros demos (rag/comparator) bajo este endpoint.
// -----------------------------------------------------------------------------

import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CorpusSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  q!: string;

  /**
   * Cuántos chunks devolver. Default 5. Tope 20 (idéntico al chat del Demo 01).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
