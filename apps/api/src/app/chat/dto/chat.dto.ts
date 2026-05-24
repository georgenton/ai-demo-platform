// DTO del query del endpoint GET /api/v1/chat?q=...&demoId=...&topK=...
//
// Como llegan por query string, todos los valores arrancan como string. El
// ValidationPipe global tiene `transform: true`, así que con @Type(Number) el
// pipe convierte `topK` de string a number antes de validar.

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

export class ChatQueryDto {
  /** La pregunta del usuario. Corta y directa — preguntas muy largas se ven raras en una query string. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  q!: string;

  /** A qué demo apuntamos la búsqueda (rag, comparator, …). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  demoId!: string;

  /**
   * Cuántos chunks traer del retrieval. Default 5 (acordado en el diseño del
   * Demo 01). Tope superior 20 para evitar prompts gigantes que disparen el
   * costo del LLM o excedan su context window.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
