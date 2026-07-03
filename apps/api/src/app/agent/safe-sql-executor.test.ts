// -----------------------------------------------------------------------------
// Tests unitarios de SafeSqlExecutor — cubren la validación SIN tocar la DB.
//
// Las 3 capas de protección viven en SafeSqlExecutor.run() pero la mayoría son
// puras (verbo / allowlist de tablas). Las validamos mockeando prisma para que
// nunca llegue a la DB; si la validación rechaza antes, el mock no se invoca.
//
// La ejecución real (transacción read-only, BigInt → string, row cap) se prueba
// en safe-sql-executor.integration.test.ts contra Postgres real con datos
// seedeados.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTransaction, mockQueryRawUnsafe, mockExecuteRawUnsafe } =
  vi.hoisted(() => {
    const mockQueryRawUnsafe = vi.fn();
    const mockExecuteRawUnsafe = vi.fn();
    const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        $queryRawUnsafe: mockQueryRawUnsafe,
        $executeRawUnsafe: mockExecuteRawUnsafe,
      };
      return cb(tx);
    });
    return { mockTransaction, mockQueryRawUnsafe, mockExecuteRawUnsafe };
  });

vi.mock('@org/db', () => ({
  prisma: { $transaction: mockTransaction },
}));

import { SafeSqlExecutor } from './safe-sql-executor.js';

describe('SafeSqlExecutor (validation)', () => {
  let executor: SafeSqlExecutor;

  beforeEach(() => {
    mockTransaction.mockClear();
    mockQueryRawUnsafe.mockReset();
    mockExecuteRawUnsafe.mockReset();
    executor = new SafeSqlExecutor();
  });

  describe('verbo permitido', () => {
    it.each([
      'INSERT INTO "Student" VALUES (1)',
      'UPDATE "Student" SET fullName = \'x\'',
      'DELETE FROM "Student"',
      'DROP TABLE "Student"',
      'ALTER TABLE "Student" ADD COLUMN x text',
      'TRUNCATE "Student"',
      'CREATE TABLE foo (x int)',
    ])('rechaza statements no-SELECT: %s', async (sql) => {
      const result = await executor.run(sql);
      expect(result.ok).toBe(false);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('acepta SELECT puro contra tabla permitida', async () => {
      mockQueryRawUnsafe.mockResolvedValue([{ count: 50n }]);
      const result = await executor.run(
        'SELECT COUNT(*) AS count FROM "Student"',
      );
      expect(result.ok).toBe(true);
      expect(mockTransaction).toHaveBeenCalledOnce();
    });

    it('acepta WITH ... SELECT (CTE)', async () => {
      mockQueryRawUnsafe.mockResolvedValue([]);
      const result = await executor.run(
        'WITH t AS (SELECT id FROM "Student") SELECT COUNT(*) FROM t',
      );
      expect(result.ok).toBe(true);
    });

    it('acepta CTEs citadas con nombres PascalCase generadas por LLMs', async () => {
      mockQueryRawUnsafe.mockResolvedValue([{ count: 9n }]);
      const result = await executor.run(
        'WITH "CalcII" AS (SELECT id FROM "Course" WHERE name = \'Cálculo II\') SELECT COUNT(*) FROM "CalcII"',
      );
      expect(result.ok).toBe(true);
    });

    it('rechaza múltiples statements separados por ;', async () => {
      const result = await executor.run('SELECT 1; DROP TABLE "Student"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/múltiples statements/i);
      }
    });
  });

  describe('allowlist de tablas', () => {
    it('rechaza referencias a tablas fuera de la allowlist (Document)', async () => {
      const result = await executor.run('SELECT * FROM "Document"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Document/);
      }
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('acepta queries con JOIN entre tablas permitidas', async () => {
      mockQueryRawUnsafe.mockResolvedValue([]);
      const result = await executor.run(
        'SELECT s."fullName" FROM "Student" s JOIN "Enrollment" e ON e."studentId" = s.id',
      );
      expect(result.ok).toBe(true);
    });

    it('no se confunde con columnas en camelCase (createdAt, studentId)', async () => {
      mockQueryRawUnsafe.mockResolvedValue([]);
      const result = await executor.run(
        'SELECT "createdAt", "studentId" FROM "Enrollment" WHERE "createdAt" > now()',
      );
      // `createdAt` y `studentId` empiezan con minúscula, no son tablas.
      expect(result.ok).toBe(true);
    });
  });

  describe('coerción de BigInt', () => {
    it('convierte BigInt en string para que sea JSON-serializable', async () => {
      mockQueryRawUnsafe.mockResolvedValue([{ count: 1234567890123n }]);
      const result = await executor.run(
        'SELECT COUNT(*) AS count FROM "Student"',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.rows[0].count).toBe('1234567890123');
        // Y debe ser JSON-stringifiable.
        expect(() => JSON.stringify(result.rows)).not.toThrow();
      }
    });
  });

  describe('errores de ejecución', () => {
    it('devuelve { ok: false, error } cuando la DB lanza', async () => {
      mockQueryRawUnsafe.mockRejectedValue(
        new Error('column "x" does not exist'),
      );
      const result = await executor.run('SELECT x FROM "Student"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/does not exist/);
      }
    });
  });
});
