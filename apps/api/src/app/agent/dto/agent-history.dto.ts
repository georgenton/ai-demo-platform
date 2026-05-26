// DTOs del endpoint GET /api/v1/agent/history.
//
// Query string (limit/offset) + shape de la respuesta.

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AgentHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/** Una entrada del historial. Espejo del modelo Prisma, con createdAt como ISO string. */
export interface AgentHistoryEntry {
  id: string;
  question: string;
  sql: string | null;
  rowCount: number | null;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  turns: number;
  createdAt: string;
}

export interface AgentHistoryResponse {
  items: AgentHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}
