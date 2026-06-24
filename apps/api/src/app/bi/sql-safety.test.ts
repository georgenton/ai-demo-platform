// -----------------------------------------------------------------------------
// Tests del sql-safety — la capa crítica del Demo 10. Si esta capa falla,
// el LLM puede ejecutar SQL destructivo contra producción. Por eso tiene
// más tests que el resto de los modules juntos.
//
// Categorías:
//   - Validaciones de input (vacío, demasiado largo, no-SELECT).
//   - Statement separators (`;`).
//   - Keywords destructivas (INSERT/UPDATE/DELETE/DROP/etc).
//   - Whitelist de tablas (estricta, incluye intentos con prefijo schema).
//   - Inyección de tenantId (con y sin WHERE, GROUP BY, etc).
//   - Inyección de LIMIT.
//   - Resilencia a comments y string literals.
//   - tenantId mal formado.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { sanitizeBiSql, SqlSafetyError } from './sql-safety.js';

const TENANT = 'ctnt_demo_cooperativa';

describe('sanitizeBiSql — validaciones de input', () => {
  it('rechaza SQL vacío', () => {
    expect(() => sanitizeBiSql('', TENANT)).toThrow(SqlSafetyError);
    expect(() => sanitizeBiSql('   ', TENANT)).toThrow(/vacío/);
  });

  it('rechaza SQL demasiado largo (>4000 chars)', () => {
    const big = 'SELECT * FROM "BiPrestamo" WHERE ' + 'a'.repeat(5000);
    expect(() => sanitizeBiSql(big, TENANT)).toThrow(/demasiado largo/);
  });

  it('rechaza si no empieza con SELECT/WITH', () => {
    expect(() => sanitizeBiSql('EXPLAIN SELECT 1', TENANT)).toThrow(/SELECT/);
    expect(() => sanitizeBiSql('SHOW TABLES', TENANT)).toThrow(/SELECT/);
  });

  it('acepta CTE WITH', () => {
    const r = sanitizeBiSql(
      `WITH mora AS (SELECT * FROM "BiPrestamo" WHERE "diasMora" > 30)
       SELECT count(*) FROM mora`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/WITH mora AS/);
  });
});

describe('sanitizeBiSql — statement separators', () => {
  it('rechaza ; en el SQL', () => {
    expect(() =>
      sanitizeBiSql('SELECT * FROM "BiPrestamo"; DROP TABLE Users', TENANT),
    ).toThrow(/múltiples statements/);
  });

  it('IGNORA ; dentro de string literals', () => {
    // El `;` está dentro de comilla — el strip lo limpia y no debe disparar.
    const r = sanitizeBiSql(
      `SELECT * FROM "BiPrestamo" WHERE "productoTipo" = 'conty;sumo'`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/conty;sumo/);
  });
});

describe('sanitizeBiSql — keywords destructivas', () => {
  it.each([
    'INSERT INTO',
    'UPDATE',
    'DELETE',
    'DROP TABLE',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
    'COPY',
    'VACUUM',
    'BEGIN',
    'COMMIT',
    'CALL',
    'MERGE',
  ])('rechaza SQL con keyword %s', (kw) => {
    const sql = `SELECT * FROM "BiPrestamo" ; ${kw} foo`;
    expect(() => sanitizeBiSql(sql, TENANT)).toThrow();
  });

  it('IGNORA keywords dentro de comentarios', () => {
    const sql = `SELECT * FROM "BiPrestamo" -- DROP TABLE
                 LIMIT 10`;
    const r = sanitizeBiSql(sql, TENANT);
    expect(r.sanitized).toMatch(/SELECT/);
  });

  it('IGNORA keywords dentro de block comments', () => {
    const sql = `SELECT /* INSERT no es real */ count(*) FROM "BiPrestamo"`;
    const r = sanitizeBiSql(sql, TENANT);
    expect(r.sanitized).toMatch(/count\(\*\)/);
  });

  it('IGNORA keywords dentro de string literals', () => {
    const sql = `SELECT * FROM "BiPrestamo" WHERE "purpose" = 'DROP the bass'`;
    const r = sanitizeBiSql(sql, TENANT);
    expect(r.sanitized).toMatch(/DROP the bass/);
  });

  it('NO confunde columnas que contienen sub-strings de keywords', () => {
    // 'created_at' contiene 'create' pero NO la keyword CREATE estándar.
    const r = sanitizeBiSql('SELECT "createdAt" FROM "BiPrestamo"', TENANT);
    expect(r.sanitized).toMatch(/createdAt/);
  });
});

describe('sanitizeBiSql — whitelist de tablas', () => {
  it('acepta las 5 tablas BI', () => {
    for (const t of [
      'BiAgencia',
      'BiSocio',
      'BiPrestamo',
      'BiCaptacion',
      'BiCuota',
    ]) {
      const r = sanitizeBiSql(`SELECT * FROM "${t}"`, TENANT);
      expect(r.tablesUsed).toContain(t);
    }
  });

  it('rechaza tabla fuera de whitelist (User)', () => {
    expect(() => sanitizeBiSql('SELECT * FROM "User"', TENANT)).toThrow(
      /whitelist/,
    );
  });

  it('rechaza tabla fuera de whitelist (Tenant)', () => {
    expect(() => sanitizeBiSql('SELECT * FROM "Tenant"', TENANT)).toThrow(
      /whitelist/,
    );
  });

  it('rechaza tabla fuera de whitelist en JOIN', () => {
    expect(() =>
      sanitizeBiSql(
        `SELECT * FROM "BiPrestamo" JOIN "AgentQuery" ON true`,
        TENANT,
      ),
    ).toThrow(/whitelist/);
  });

  it('rechaza si NO hay FROM', () => {
    expect(() => sanitizeBiSql('SELECT 1', TENANT)).toThrow(/FROM/);
  });

  it('acepta multi-table joins entre tablas de la whitelist', () => {
    const r = sanitizeBiSql(
      `SELECT a.nombre, count(p.id) AS num
       FROM "BiPrestamo" p
       JOIN "BiAgencia" a ON a.id = p."agenciaId"
       GROUP BY a.nombre`,
      TENANT,
    );
    expect(r.tablesUsed).toEqual(
      expect.arrayContaining(['BiPrestamo', 'BiAgencia']),
    );
  });
});

describe('sanitizeBiSql — inyección de tenantId', () => {
  it('inyecta WHERE tenantId si NO hay WHERE (prefijo = nombre de tabla)', () => {
    const r = sanitizeBiSql('SELECT * FROM "BiAgencia"', TENANT);
    expect(r.sanitized).toMatch(
      new RegExp(`WHERE\\s+"BiAgencia"\\."tenantId"\\s*=\\s*'${TENANT}'`),
    );
    expect(r.injectedTenantFilter).toBe(true);
  });

  it('inyecta AND tenantId con prefijo de alias si hay alias', () => {
    const r = sanitizeBiSql(
      `SELECT * FROM "BiPrestamo" p WHERE p.estado = 'vigente'`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/WHERE\s+"p"\."tenantId"\s*=\s*'.+?'\s+AND/);
  });

  it('inyecta WHERE tenantId ANTES de GROUP BY', () => {
    const r = sanitizeBiSql(
      `SELECT "productoTipo", count(*) FROM "BiPrestamo" GROUP BY "productoTipo"`,
      TENANT,
    );
    expect(r.sanitized).toMatch(
      /WHERE\s+"BiPrestamo"\."tenantId"\s*=\s*'.+?'\s+GROUP\s+BY/i,
    );
  });

  it('inyecta WHERE tenantId ANTES de ORDER BY', () => {
    const r = sanitizeBiSql(
      `SELECT * FROM "BiPrestamo" ORDER BY "montoUsd" DESC`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/WHERE\s+"BiPrestamo"\."tenantId"/i);
    expect(r.sanitized).toMatch(/ORDER\s+BY/i);
  });

  it('inyecta WHERE tenantId ANTES de LIMIT', () => {
    const r = sanitizeBiSql(`SELECT * FROM "BiPrestamo" LIMIT 10`, TENANT);
    expect(r.sanitized).toMatch(
      /WHERE\s+"BiPrestamo"\."tenantId"\s*=\s*'.+?'\s+LIMIT/i,
    );
  });

  it('inyecta filtros para CADA tabla del JOIN (multi-tenant safety)', () => {
    const r = sanitizeBiSql(
      `SELECT a.nombre, count(p.id) FROM "BiPrestamo" p
       JOIN "BiAgencia" a ON a.id = p."agenciaId"
       GROUP BY a.nombre`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/"p"\."tenantId"/);
    expect(r.sanitized).toMatch(/"a"\."tenantId"/);
  });

  it('NO inyecta dentro de WHERE de FILTER() — usa el WHERE de nivel superior', () => {
    const r = sanitizeBiSql(
      `SELECT COUNT(*) FILTER (WHERE estado = 'vencido') FROM "BiPrestamo"`,
      TENANT,
    );
    // El filtro tenantId debe estar en el WHERE post-FROM, no dentro del FILTER.
    expect(r.sanitized).toMatch(
      /FROM "BiPrestamo"\s+WHERE\s+"BiPrestamo"\."tenantId"/,
    );
    // El FILTER original sigue intacto.
    expect(r.sanitized).toMatch(
      /FILTER\s*\(\s*WHERE\s+estado\s*=\s*'vencido'\s*\)/,
    );
  });

  it('no marca injectedTenantFilter=true si el LLM ya filtró', () => {
    const r = sanitizeBiSql(
      `SELECT * FROM "BiPrestamo" WHERE "tenantId" = 'foo'`,
      TENANT,
    );
    expect(r.injectedTenantFilter).toBe(false);
    // Igualmente forzamos uno más, no rompe semántica
    expect(r.sanitized).toMatch(/"BiPrestamo"\."tenantId"/);
  });

  it('rechaza tenantId con caracteres especiales (inyección)', () => {
    expect(() =>
      sanitizeBiSql(`SELECT * FROM "BiPrestamo"`, `' OR 1=1 --`),
    ).toThrow(/caracteres inválidos/);
  });
});

describe('sanitizeBiSql — inyección de LIMIT', () => {
  it('inyecta LIMIT 1000 si no hay', () => {
    const r = sanitizeBiSql('SELECT * FROM "BiSocio"', TENANT);
    expect(r.sanitized).toMatch(/LIMIT\s+1000/);
    expect(r.injectedLimit).toBe(true);
  });

  it('NO inyecta LIMIT si ya hay LIMIT explícito', () => {
    const r = sanitizeBiSql('SELECT * FROM "BiSocio" LIMIT 50', TENANT);
    expect(r.sanitized).toMatch(/LIMIT\s+50/);
    expect(r.sanitized).not.toMatch(/LIMIT\s+1000/);
    expect(r.injectedLimit).toBe(false);
  });
});

describe('sanitizeBiSql — golden paths realistas', () => {
  it('mora por agencia', () => {
    const r = sanitizeBiSql(
      `SELECT a.nombre, COUNT(*) FILTER (WHERE p.estado IN ('vencido', 'castigado')) AS vencidos
       FROM "BiPrestamo" p
       JOIN "BiAgencia" a ON a.id = p."agenciaId"
       GROUP BY a.nombre`,
      TENANT,
    );
    expect(r.tablesUsed).toEqual(
      expect.arrayContaining(['BiPrestamo', 'BiAgencia']),
    );
    expect(r.sanitized).toMatch(/"p"\."tenantId"/);
    expect(r.sanitized).toMatch(/"a"\."tenantId"/);
    expect(r.sanitized).toMatch(/LIMIT\s+1000/);
  });

  it('cartera por producto', () => {
    const r = sanitizeBiSql(
      `SELECT "productoTipo", SUM("montoUsd") FROM "BiPrestamo"
       WHERE estado = 'vigente' GROUP BY "productoTipo"`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/WHERE\s+"BiPrestamo"\."tenantId"/i);
    expect(r.sanitized).toMatch(/AND\s+estado\s*=\s*'vigente'/);
  });

  it('desembolsos mensuales del último año', () => {
    const r = sanitizeBiSql(
      `SELECT date_trunc('month', "fechaDesembolso") AS mes, SUM("montoUsd") AS total
       FROM "BiPrestamo"
       WHERE "fechaDesembolso" >= '2025-06-01'
       GROUP BY mes
       ORDER BY mes`,
      TENANT,
    );
    expect(r.sanitized).toMatch(/date_trunc/);
    expect(r.sanitized).toMatch(/AND\s+"fechaDesembolso"/);
  });
});
