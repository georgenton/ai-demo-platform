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

  /**
   * Override del provider del LLM para esta llamada (`anthropic` |
   * `private-mac` | etc.). Llega por query string porque `EventSource` del
   * browser no soporta headers custom — los otros demos (POST + fetch)
   * propagan lo mismo por el header `X-LLM-Provider`.
   *
   * Tiene que estar declarado acá aunque no lo usemos en el handler: el
   * `ValidationPipe` global corre con `forbidNonWhitelisted: true` y
   * rechazaría con 400 cualquier param no listado. La validación real del
   * valor la hace el decorator `@CurrentLlmProvider()` con
   * `isValidChatProvider()`; si el string no matchea un provider conocido,
   * el decorator devuelve `undefined` y el adapter cae al singleton del env.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  llmProvider?: string;
}
