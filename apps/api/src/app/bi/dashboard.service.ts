// -----------------------------------------------------------------------------
// BiDashboardService — CRUD del dashboard guardado (Demo 10 sub-PR 4).
//
// Responsabilidades:
//   - list:    items del tenant, ordenados por `order` asc + `createdAt` desc.
//   - create:  guarda un item (el frontend ya tiene SQL sanitizado + spec).
//   - update:  cambia title u order.
//   - remove:  borra un item.
//   - execute: re-ejecuta el SQL guardado y devuelve filas frescas.
//
// La seguridad del SQL guardado SE ASUME por construcción: solo entra a la
// tabla a través del POST /bi/dashboard que recibe un `sql` que YA pasó por
// sanitizeBiSql en el momento del `run_sql` del chat. Si alguien intenta
// guardar un SQL crudo malicioso, la query falla al ejecutar contra el user
// DB read-only.
//
// Para defense in depth, en `execute()` validamos que el SQL guardado sigue
// matcheando la whitelist + filtros básicos antes de re-ejecutarlo.
// -----------------------------------------------------------------------------

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma, prisma } from '@org/db';

import type {
  BiDashboardItemDto,
  BiDashboardItemExecuteResult,
  CreateDashboardItemDto,
  UpdateDashboardItemDto,
} from './dto/dashboard.dto.js';
import { sanitizeBiSql, SqlSafetyError } from './sql-safety.js';

@Injectable()
export class BiDashboardService {
  private readonly logger = new Logger(BiDashboardService.name);

  async list(tenantId: string): Promise<BiDashboardItemDto[]> {
    const items = await prisma.biDashboardItem.findMany({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map(toDto);
  }

  async create(
    tenantId: string,
    input: CreateDashboardItemDto,
  ): Promise<BiDashboardItemDto> {
    // Defense in depth: verificar que el SQL aún cumple las reglas. Si no,
    // el item nunca se crea — algo raro pasó upstream.
    try {
      sanitizeBiSql(input.sql, tenantId);
    } catch (err) {
      if (err instanceof SqlSafetyError) {
        throw new SqlSafetyError(
          `El SQL guardado no cumple las reglas de seguridad: ${err.message}`,
        );
      }
      throw err;
    }

    // tablesUsed se recalcula desde el sql sanitizado (mismo resultado).
    const sanitized = sanitizeBiSql(input.sql, tenantId);

    const created = await prisma.biDashboardItem.create({
      data: {
        tenantId,
        title: input.title.trim(),
        question: input.question.trim(),
        sql: input.sql.trim(),
        tablesUsed: sanitized.tablesUsed,
        chartSpec: input.chartSpec as Prisma.InputJsonValue,
        order: 0,
      },
    });
    this.logger.log(
      `dashboard item created: tenant=${tenantId} id=${created.id} title="${created.title}"`,
    );
    return toDto(created);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateDashboardItemDto,
  ): Promise<BiDashboardItemDto> {
    const existing = await prisma.biDashboardItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Dashboard item ${id} no existe.`);
    }
    const updated = await prisma.biDashboardItem.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
      },
    });
    return toDto(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await prisma.biDashboardItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Dashboard item ${id} no existe.`);
    }
    await prisma.biDashboardItem.delete({ where: { id } });
  }

  async execute(
    tenantId: string,
    id: string,
  ): Promise<BiDashboardItemExecuteResult> {
    const item = await prisma.biDashboardItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) {
      throw new NotFoundException(`Dashboard item ${id} no existe.`);
    }

    // Re-sanitizar — confirma que el SQL no fue tampered en BD y vuelve a
    // inyectar el filtro de tenantId del request (defense in depth para
    // multi-tenant).
    const sanitized = sanitizeBiSql(item.sql, tenantId);

    let result: Array<Record<string, unknown>>;
    try {
      result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        sanitized.sanitized,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Falló la ejecución del item guardado: ${message.slice(0, 300)}`,
      );
    }

    if (result.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executedAt: new Date().toISOString(),
      };
    }

    const columns = Object.keys(result[0]);
    const rows = result.map((r) =>
      columns.map((c) => {
        const v = r[c];
        if (typeof v === 'bigint') return v.toString();
        if (v !== null && typeof v === 'object' && 'toFixed' in (v as object)) {
          return (v as { toString(): string }).toString();
        }
        return v;
      }),
    );

    return {
      columns,
      rows,
      rowCount: rows.length,
      executedAt: new Date().toISOString(),
    };
  }
}

function toDto(item: {
  id: string;
  title: string;
  question: string;
  sql: string;
  tablesUsed: string[];
  chartSpec: Prisma.JsonValue;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}): BiDashboardItemDto {
  return {
    id: item.id,
    title: item.title,
    question: item.question,
    sql: item.sql,
    tablesUsed: item.tablesUsed,
    chartSpec: item.chartSpec as Record<string, unknown>,
    order: item.order,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
