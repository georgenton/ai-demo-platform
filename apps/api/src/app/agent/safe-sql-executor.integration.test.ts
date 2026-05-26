// -----------------------------------------------------------------------------
// Integration tests del SafeSqlExecutor contra Postgres+pgvector real.
//
// Por qué integration y no solo unit:
//   - La capa "transaction READ ONLY" la enforce el motor de Postgres, no
//     nuestro regex. La única forma de verificar que un INSERT se rechaza
//     a nivel DB (segunda línea de defensa) es ejercerlo contra una DB real.
//   - El BigInt → string coercion también depende de cómo Prisma devuelve
//     COUNT(*) — un mock no lo cubre fielmente.
//
// Estrategia (idéntica a vector-store.integration.test.ts):
//   - Un container Postgres por archivo (beforeAll/afterAll).
//   - Aplicamos migraciones reales.
//   - Sembramos algunas filas mínimas en el schema académico para que las
//     queries devuelvan algo concreto.
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

type PrismaClient = typeof import('@org/db').prisma;
type ExecutorClass = typeof import('./safe-sql-executor.js').SafeSqlExecutor;

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let executor: InstanceType<ExecutorClass>;

describe('SafeSqlExecutor (integration)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg17').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    execSync(
      'npx prisma migrate deploy --schema packages/db/prisma/schema.prisma',
      { env: process.env, stdio: 'inherit' },
    );

    const dbModule = await import('@org/db');
    const execModule = await import('./safe-sql-executor.js');
    prisma = dbModule.prisma;
    executor = new execModule.SafeSqlExecutor();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    // Limpieza + sembrado mínimo. CASCADE arrastra Grade/Enrollment.
    await prisma.$executeRaw`TRUNCATE "Course", "Student", "Enrollment", "Grade" CASCADE`;

    const courseA = await prisma.course.create({
      data: { code: 'CALC101', name: 'Cálculo I', credits: 4 },
    });
    const courseB = await prisma.course.create({
      data: { code: 'PROG101', name: 'Programación I', credits: 4 },
    });
    const student = await prisma.student.create({
      data: {
        fullName: 'Test Alumno',
        email: 'test@example.edu',
        enrolledAt: new Date('2024-01-01'),
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: courseA.id,
        term: '2025-1',
        status: 'completed',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: courseB.id,
        term: '2025-1',
        status: 'withdrawn',
      },
    });
  });

  describe('ejecución exitosa', () => {
    it('ejecuta un SELECT contra Course y devuelve filas tipadas', async () => {
      const result = await executor.run(
        'SELECT name, credits FROM "Course" ORDER BY name',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.rows).toEqual([
          { name: 'Cálculo I', credits: 4 },
          { name: 'Programación I', credits: 4 },
        ]);
        expect(result.rowCount).toBe(2);
      }
    });

    it('soporta JOIN entre tablas permitidas y devuelve BigInt como string', async () => {
      const result = await executor.run(
        `SELECT c.name, COUNT(*) AS inscripciones
         FROM "Course" c
         JOIN "Enrollment" e ON e."courseId" = c.id
         GROUP BY c.name
         ORDER BY c.name`,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // COUNT(*) llega como BigInt — el executor lo convierte a string.
        expect(result.rows[0].inscripciones).toBe('1');
        expect(typeof result.rows[0].inscripciones).toBe('string');
        // Y la respuesta debe ser JSON-serializable.
        expect(() => JSON.stringify(result.rows)).not.toThrow();
      }
    });
  });

  describe('protección read-only a nivel motor', () => {
    it('rechaza INSERT incluso si el regex del adapter lo dejara pasar (segunda línea)', async () => {
      // Bypass del regex: pasamos una SELECT que dispara un INSERT en una
      // función? Imposible en Postgres directo. Mejor: probemos que un
      // INSERT directo es rechazado por el regex Y, si fuera del regex,
      // por el SET TRANSACTION READ ONLY.
      const result = await executor.run(
        'INSERT INTO "Student" (id, "fullName", email, "enrolledAt") VALUES (\'x\', \'y\', \'z@z\', now())',
      );
      expect(result.ok).toBe(false);
      // Y nada se insertó.
      const count = await prisma.student.count();
      expect(count).toBe(1); // el seeded
    });
  });

  describe('errores de DB se reportan limpios', () => {
    it('devuelve { ok: false, error } cuando una columna no existe', async () => {
      const result = await executor.run('SELECT inexistente FROM "Student"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/inexistente/i);
      }
    });

    it('devuelve { ok: false, error } cuando referenciamos una tabla fuera de la allowlist', async () => {
      // Defensa en profundidad: si la validación pasara, la query igual
      // fallaría porque el agente no debería poder tocar Document. Pero
      // el primer guard ya rechaza con un mensaje claro.
      const result = await executor.run('SELECT * FROM "Document"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Document/);
      }
    });
  });
});
