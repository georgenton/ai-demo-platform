// -----------------------------------------------------------------------------
// DTOs del dashboard guardado (Demo 10 sub-PR 4).
//
// El dashboard es una colección de "items" persistidos. Cada item guarda
// el SQL ya sanitizado + la spec del chart + título + pregunta original.
// Cuando un usuario abre /demo/bi/dashboard, el frontend re-ejecuta cada
// item para mostrar datos frescos.
// -----------------------------------------------------------------------------

import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Body del POST /bi/dashboard — crear un item nuevo. */
export class CreateDashboardItemDto {
  @IsString()
  @MaxLength(120, {
    message: 'title excede 120 caracteres — usa algo más corto.',
  })
  title!: string;

  @IsString()
  @MaxLength(800, {
    message: 'question excede 800 caracteres — recórtala.',
  })
  question!: string;

  @IsString()
  @MaxLength(4000, { message: 'sql excede 4000 caracteres.' })
  sql!: string;

  /**
   * `chartSpec` viene tal cual lo emitió render_chart. No validamos su
   * shape acá porque ya pasó por `parseRenderChartInput` en el momento
   * de generación; lo guardamos como JSON opaco.
   */
  @IsObject()
  chartSpec!: Record<string, unknown>;
}

/** Body del PATCH /bi/dashboard/:id. */
export class UpdateDashboardItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  /** Reordenar — menor número = arriba/izquierda. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}

/** Forma del item que devuelve el backend al frontend. */
export interface BiDashboardItemDto {
  id: string;
  title: string;
  question: string;
  sql: string;
  tablesUsed: string[];
  chartSpec: Record<string, unknown>;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Resultado de POST /bi/dashboard/:id/execute. */
export interface BiDashboardItemExecuteResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  /** ISO timestamp del momento de ejecución. */
  executedAt: string;
}
