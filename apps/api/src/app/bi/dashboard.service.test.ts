// -----------------------------------------------------------------------------
// Tests del BiDashboardService — focalizados en re-sanitización al ejecutar.
//
// Mockeamos `prisma` para evitar tocar BD. Solo testeamos:
//   - `create()` valida que el SQL entrante pasa sql-safety.
//   - `execute()` rechaza si el SQL guardado fue tampered y ya no cumple
//     las reglas.
//
// Las queries reales (list/update/remove) son CRUD trivial — cobertura por
// integración cuando el frontend los consuma.
// -----------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@org/db', () => ({
  prisma: {
    biDashboardItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
  Prisma: {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPrisma: any;

beforeEach(async () => {
  const dbModule = await import('@org/db');
  mockPrisma = dbModule.prisma;
  for (const fn of Object.values(mockPrisma.biDashboardItem)) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  (mockPrisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockReset();
});

import { BiDashboardService } from './dashboard.service.js';
import { SqlSafetyError } from './sql-safety.js';

describe('BiDashboardService.create', () => {
  it('rechaza si el SQL no cumple sql-safety (ej. INSERT)', async () => {
    const svc = new BiDashboardService();
    await expect(
      svc.create('tenant1', {
        title: 'Hack',
        question: 'borrar tabla',
        sql: 'INSERT INTO "BiPrestamo" VALUES (1, 2)',
        chartSpec: { chartType: 'bar' },
      }),
    ).rejects.toThrow(SqlSafetyError);
    expect(mockPrisma.biDashboardItem.create).not.toHaveBeenCalled();
  });

  it('rechaza si la tabla no está en la whitelist', async () => {
    const svc = new BiDashboardService();
    await expect(
      svc.create('tenant1', {
        title: 'Espía',
        question: 'leer users',
        sql: 'SELECT * FROM "User"',
        chartSpec: { chartType: 'bar' },
      }),
    ).rejects.toThrow(/whitelist/);
  });

  it('persiste cuando el SQL es válido', async () => {
    mockPrisma.biDashboardItem.create.mockResolvedValue({
      id: 'item-1',
      tenantId: 'tenant1',
      title: 'Mora por agencia',
      question: '¿Cuál agencia tiene más mora?',
      sql: 'SELECT * FROM "BiPrestamo"',
      tablesUsed: ['BiPrestamo'],
      chartSpec: { chartType: 'bar' },
      order: 0,
      createdAt: new Date('2026-06-24'),
      updatedAt: new Date('2026-06-24'),
    });
    const svc = new BiDashboardService();
    const result = await svc.create('tenant1', {
      title: 'Mora por agencia',
      question: '¿Cuál agencia tiene más mora?',
      sql: 'SELECT * FROM "BiPrestamo"',
      chartSpec: { chartType: 'bar' },
    });
    expect(result.id).toBe('item-1');
    expect(mockPrisma.biDashboardItem.create).toHaveBeenCalledTimes(1);
    const callArg = mockPrisma.biDashboardItem.create.mock.calls[0][0];
    expect(callArg.data.tenantId).toBe('tenant1');
    expect(callArg.data.tablesUsed).toEqual(['BiPrestamo']);
  });
});

describe('BiDashboardService.execute', () => {
  it('404 si el item no existe', async () => {
    mockPrisma.biDashboardItem.findFirst.mockResolvedValue(null);
    const svc = new BiDashboardService();
    await expect(svc.execute('tenant1', 'no-existe')).rejects.toThrow();
  });

  it('re-sanitiza el SQL guardado antes de ejecutar (defense in depth)', async () => {
    // Item en BD con un SQL "tampered" que ya no cumple las reglas.
    mockPrisma.biDashboardItem.findFirst.mockResolvedValue({
      id: 'item-1',
      tenantId: 'tenant1',
      title: 'Tampered',
      question: 'X',
      sql: 'DROP TABLE "BiPrestamo"',
      tablesUsed: ['BiPrestamo'],
      chartSpec: {},
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const svc = new BiDashboardService();
    await expect(svc.execute('tenant1', 'item-1')).rejects.toThrow(
      SqlSafetyError,
    );
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('ejecuta y devuelve filas cuando el SQL guardado sigue válido', async () => {
    mockPrisma.biDashboardItem.findFirst.mockResolvedValue({
      id: 'item-1',
      tenantId: 'tenant1',
      title: 'OK',
      question: 'X',
      sql: 'SELECT nombre FROM "BiAgencia"',
      tablesUsed: ['BiAgencia'],
      chartSpec: {},
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { nombre: 'Agencia Quito Centro' },
      { nombre: 'Agencia Cuenca' },
    ]);
    const svc = new BiDashboardService();
    const result = await svc.execute('tenant1', 'item-1');
    expect(result.columns).toEqual(['nombre']);
    expect(result.rows).toHaveLength(2);
    expect(result.rowCount).toBe(2);
    // Verificar que el SQL ejecutado tiene tenantId inyectado.
    const executedSql = mockPrisma.$queryRawUnsafe.mock.calls[0][0];
    expect(executedSql).toMatch(/"BiAgencia"\."tenantId" = 'tenant1'/);
  });

  it('rejects tenant cross-access — un tenant no puede ejecutar item de otro', async () => {
    // findFirst con where { id, tenantId } no encuentra → 404.
    mockPrisma.biDashboardItem.findFirst.mockResolvedValue(null);
    const svc = new BiDashboardService();
    await expect(svc.execute('attacker', 'item-victima')).rejects.toThrow();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
