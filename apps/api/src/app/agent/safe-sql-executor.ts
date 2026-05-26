// -----------------------------------------------------------------------------
// SafeSqlExecutor — ejecuta SQL generada por el LLM contra Postgres con tres
// candados pensados para que el agente NO pueda hacer daño aunque alucine:
//
//   1) Allowlist de tablas. Solo se aceptan referencias a las tablas del
//      schema académico (Course, Student, Enrollment, Grade). Document y
//      Chunk del Demo 01 quedan fuera de alcance.
//   2) Solo SELECT. Cualquier statement que empiece con WITH (CTEs) también
//      se acepta, pero cualquier verbo de mutación (INSERT/UPDATE/DELETE/
//      DROP/ALTER/TRUNCATE/CREATE/GRANT/...) lo rechazamos.
//   3) Transacción read-only + LIMIT efectivo. Postgres con `READ ONLY`
//      rechaza mutaciones a nivel motor — segunda línea de defensa por si
//      el regex no captó algo. Y capeamos las filas devueltas para que el
//      LLM no se ahogue en un resultset gigante.
//
// Implementación: prisma.$queryRawUnsafe en una transacción interactiva
// con `SET TRANSACTION READ ONLY`. Devolvemos `{ rows, rowCount, durationMs }`
// o un error con la causa.
//
// Por qué `$queryRawUnsafe` y no `$queryRaw` (tagged template):
//   La SQL viene del LLM como string completa, no como template literal. La
//   alternativa "segura" de Prisma es `$queryRaw`, pero esa exige interpolar
//   parámetros como expresiones tag. Acá no hay parámetros: el LLM genera la
//   SQL entera. La protección NO viene de tagged templates; viene de las 3
//   capas de arriba.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';

/** Tablas permitidas. Cualquier identificador citado fuera de esta lista → reject. */
const ALLOWED_TABLES = new Set(['Course', 'Student', 'Enrollment', 'Grade']);

/** Verbos prohibidos al inicio del statement (case-insensitive). */
const FORBIDDEN_VERBS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'truncate',
  'create',
  'grant',
  'revoke',
  'merge',
  'comment',
  'vacuum',
  'analyze',
  'reindex',
  'copy',
];

/** Tope superior duro: nunca devolvemos más filas que esto, sin importar el LIMIT del LLM. */
const HARD_ROW_CAP = 100;

/** Timeout duro de ejecución para que una query mal armada no se quede colgada. */
const STATEMENT_TIMEOUT_MS = 5_000;

export interface SqlExecOk {
  ok: true;
  /** Filas devueltas — array plano, cada fila es un objeto con columnas como keys. */
  rows: Record<string, unknown>[];
  rowCount: number;
  /** Tiempo de ejecución de la query en ms (sin contar overhead de Prisma). */
  durationMs: number;
  /** `true` si truncamos el resultset al HARD_ROW_CAP. */
  truncated: boolean;
}

export interface SqlExecErr {
  ok: false;
  error: string;
}

export type SqlExecResult = SqlExecOk | SqlExecErr;

@Injectable()
export class SafeSqlExecutor {
  private readonly logger = new Logger(SafeSqlExecutor.name);

  async run(sql: string): Promise<SqlExecResult> {
    // 0) Sanitizamos: trim + quitamos un eventual `;` final (Postgres tampoco
    //    permite múltiples statements via la API de Prisma, pero por las dudas).
    const cleaned = sql.trim().replace(/;\s*$/, '');

    // 1) Verbo permitido (SELECT o WITH ... SELECT)
    const verbCheck = this.checkLeadingVerb(cleaned);
    if (!verbCheck.ok) return verbCheck;

    // 2) Tablas referenciadas — solo allowlist
    const tableCheck = this.checkAllowedTables(cleaned);
    if (!tableCheck.ok) return tableCheck;

    // 3) Ejecución en transacción read-only con timeout.
    try {
      const started = Date.now();
      const rowsRaw = await prisma.$transaction(
        async (tx) => {
          // SET LOCAL solo afecta esta transacción — al rollback/commit se revierte.
          await tx.$executeRawUnsafe('SET LOCAL TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe(
            `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`,
          );
          return tx.$queryRawUnsafe<Record<string, unknown>[]>(cleaned);
        },
        { timeout: STATEMENT_TIMEOUT_MS + 1000 },
      );
      const durationMs = Date.now() - started;

      const truncated = rowsRaw.length > HARD_ROW_CAP;
      const rows = truncated ? rowsRaw.slice(0, HARD_ROW_CAP) : rowsRaw;

      // BigInt → string. COUNT(*) devuelve BigInt y JSON.stringify falla con BigInt.
      const safeRows = rows.map((row) => this.coerceBigInts(row));

      this.logger.log(
        `SQL ok (${safeRows.length}/${rowsRaw.length} rows, ${durationMs}ms)`,
      );

      return {
        ok: true,
        rows: safeRows,
        rowCount: rowsRaw.length,
        durationMs,
        truncated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SQL error: ${message}`);
      return { ok: false, error: message };
    }
  }

  // ---------------------------------------------------------------------------
  // Validaciones privadas
  // ---------------------------------------------------------------------------

  private checkLeadingVerb(sql: string): SqlExecResult {
    const lower = sql.toLowerCase();
    // Permitido: select | with (CTEs)
    if (!/^\s*(select|with)\b/.test(lower)) {
      return {
        ok: false,
        error:
          'Solo se permiten consultas SELECT (o WITH ... SELECT). ' +
          `Verbo detectado al inicio: "${sql.split(/\s+/, 1)[0]}".`,
      };
    }
    // Verificamos también que ningún verbo prohibido aparezca como statement
    // separado (defensa contra "SELECT 1; DROP TABLE x"). El `;` ya fue
    // removido del final, pero podría haber uno intermedio.
    if (sql.includes(';')) {
      return {
        ok: false,
        error: 'No se permiten múltiples statements (";" en medio del SQL).',
      };
    }
    for (const verb of FORBIDDEN_VERBS) {
      // \b para evitar matchear "create" dentro de "createdAt" (¡columnas!).
      // Pero `createdAt` no es un verbo aislado, así que un regex de palabra
      // entera funciona: \bcreate\b NO matchea "createdAt".
      const re = new RegExp(`\\b${verb}\\b`, 'i');
      if (re.test(lower)) {
        return {
          ok: false,
          error: `Verbo prohibido detectado en la consulta: "${verb}". Solo lectura.`,
        };
      }
    }
    return { ok: true } as SqlExecOk; // placeholder; sólo se accede a .ok
  }

  private checkAllowedTables(sql: string): SqlExecResult {
    // Buscamos identificadores citados con doble-comilla — Prisma genera las
    // tablas con CamelCase y las cita siempre así en sus migraciones.
    // (Un alias `FROM Student s` sin comillas también lo cubrimos abajo.)
    const quoted = sql.match(/"([A-Za-z_][\w]*)"/g) ?? [];
    const unquotedFromJoin =
      sql.match(/\b(?:from|join)\s+([A-Za-z_][\w]*)/gi) ?? [];

    const referenced = new Set<string>();
    for (const m of quoted) referenced.add(m.replace(/"/g, ''));
    for (const m of unquotedFromJoin) {
      const name = m.replace(/^\s*(from|join)\s+/i, '');
      referenced.add(name);
    }

    // De los referenciados, los que parezcan tablas (PascalCase) deben estar
    // en la allowlist. Identificadores en lowercase típicamente son columnas
    // (`createdAt`, `studentId`...) y los ignoramos.
    const tableLike = [...referenced].filter((id) => /^[A-Z]/.test(id));
    const forbidden = tableLike.filter((t) => !ALLOWED_TABLES.has(t));

    if (forbidden.length > 0) {
      return {
        ok: false,
        error:
          `Tabla(s) no permitida(s): ${forbidden.join(', ')}. ` +
          `Permitidas: ${[...ALLOWED_TABLES].join(', ')}.`,
      };
    }
    return { ok: true } as SqlExecOk;
  }

  /**
   * Convierte BigInt → string en cada valor del row. JSON.stringify de BigInt
   * tira `TypeError: Do not know how to serialize a BigInt`. Postgres devuelve
   * BigInt para COUNT(*), SUM, etc. al usar $queryRawUnsafe.
   */
  private coerceBigInts(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
    return out;
  }
}
