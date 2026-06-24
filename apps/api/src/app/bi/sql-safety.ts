// -----------------------------------------------------------------------------
// sql-safety.ts — sanitización de SQL generado por el LLM (ADR-0021, sub-PR 2).
//
// El LLM SOLO debe poder ejecutar SELECT contra una whitelist cerrada de tablas
// del warehouse Bi*. Esta capa es la PRIMERA línea de defensa; el usuario DB
// read-only es la última.
//
// 5 capas de seguridad aplicadas en orden:
//
//   1. Strip de comentarios + string literals — para que las regex de
//      detección NO se confundan por keywords dentro de strings/comments.
//   2. Rechazo de keywords destructivas (INSERT/UPDATE/DELETE/DROP/...).
//   3. Rechazo de SQL con `;` (statement separator) — no permitimos multi-stmt.
//   4. Whitelist de tablas — extraemos identificadores después de FROM/JOIN
//      y rechazamos cualquiera fuera de la lista.
//   5. Inyección obligatoria de filtro por tenantId — si el LLM olvida el
//      WHERE, lo agregamos forzado.
//   6. Inyección de LIMIT si no existe — evita OOM por queries sin LIMIT.
//
// Las funciones lanzan SqlSafetyError con un mensaje útil para que el
// service lo convierta en tool_result.isError y el LLM lo corrija.
// -----------------------------------------------------------------------------

/**
 * Tablas del warehouse BI que el LLM puede consultar. Cualquier otra
 * referencia (incluyendo `User`, `Tenant`, tablas de otros demos, etc.)
 * es rechazada.
 */
export const BI_WHITELIST_TABLES: ReadonlyArray<string> = [
  'BiAgencia',
  'BiSocio',
  'BiPrestamo',
  'BiCaptacion',
  'BiCuota',
];

/** LIMIT máximo que inyectamos cuando el LLM no lo pone. */
export const DEFAULT_SQL_LIMIT = 1000;

/** Error específico de la capa de safety. El service lo cachea como tool_result.isError. */
export class SqlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlSafetyError';
  }
}

/**
 * Keywords destructivas o que abren superficie. La regex usa `\b` para
 * evitar matches dentro de identificadores (ej. una columna llamada
 * `update_at` no debería disparar).
 */
const BLOCKED_KEYWORDS_RE =
  /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|COPY|VACUUM|ANALYZE|LOCK|REINDEX|CLUSTER|REFRESH|LISTEN|NOTIFY|SET|RESET|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|PREPARE|DEALLOCATE|DO|CALL|MERGE)\b/i;

/**
 * Quita comentarios y string literals para que la detección de keywords y
 * tablas no se confunda. Devuelve el SQL "neutralizado" — NO usar para
 * ejecutar; solo para análisis.
 */
function stripCommentsAndStrings(sql: string): string {
  // 1. Block comments /* ... */ (no anidados).
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // 2. Line comments -- hasta fin de línea.
  out = out.replace(/--[^\n]*/g, ' ');
  // 3. String literals con comillas simples (incluyendo escape de comilla
  //    doble '' que es estándar SQL).
  out = out.replace(/'([^']|'')*'/g, "''");
  // 4. Identificadores quoted con comillas dobles los DEJAMOS — son
  //    nombres de tabla/columna que necesitamos analizar.
  return out;
}

/**
 * Extrae los alias definidos en una cláusula CTE (`WITH alias1 AS (...),
 * alias2 AS (...) SELECT ...`). Solo soporta la forma estándar — no
 * RECURSIVE ni MATERIALIZED por simplicidad.
 *
 * Los CTEs son "tablas temporales" que el resto del query puede
 * referenciar; las agregamos a la lista permitida para ese análisis.
 */
function extractCteAliases(stripped: string): string[] {
  if (!/^\s*WITH\b/i.test(stripped)) return [];
  const aliases: string[] = [];
  // Match `<alias> AS (` o `, <alias> AS (`. Captura solo el alias.
  const re = /(?:WITH|,)\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))\s+AS\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1] ?? m[2];
    if (name) aliases.push(name);
  }
  return aliases;
}

/**
 * Encuentra el índice del primer match de `clauseRe` en `sql` que está en
 * NIVEL DE PARÉNTESIS 0 — es decir, el match del nivel superior del
 * statement. Esto evita confundir un `WHERE` dentro de
 * `COUNT(*) FILTER (WHERE ...)` o de un subquery con el WHERE principal.
 *
 * Maneja string literals con comillas simples (incluyendo el escape '').
 * Block comments y line comments deberían venir ya removidos por el caller.
 */
function findTopLevelMatch(sql: string, clauseRe: RegExp): number {
  let level = 0;
  let inQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inQuote) {
      if (c === "'") {
        if (sql[i + 1] === "'") {
          i++;
          continue;
        }
        inQuote = false;
      }
      continue;
    }
    if (c === "'") {
      inQuote = true;
      continue;
    }
    if (c === '(') level++;
    else if (c === ')') level--;
    if (level === 0) {
      clauseRe.lastIndex = 0;
      const m = clauseRe.exec(sql.slice(i));
      if (m && m.index === 0) return i;
    }
  }
  return -1;
}

/**
 * Tabla + alias usado en el FROM/JOIN. Si el LLM escribió
 * `FROM "BiPrestamo" p`, el alias es `p`. Si no puso alias, el alias es
 * el propio nombre de tabla.
 */
interface TableRef {
  table: string;
  alias: string;
}

/** Keywords SQL que NO deben ser interpretadas como alias. */
const ALIAS_BLACKLIST = new Set([
  'WHERE',
  'GROUP',
  'ORDER',
  'LIMIT',
  'OFFSET',
  'HAVING',
  'UNION',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'OUTER',
  'CROSS',
  'FULL',
  'NATURAL',
  'LATERAL',
  'ON',
  'USING',
  'FETCH',
  'WITH',
]);

/**
 * Extrae cada FROM/JOIN con su alias (si lo tiene). Permite las dos
 * formas: `FROM "T" alias` y `FROM "T" AS alias`. Si la "palabra
 * siguiente" es una keyword SQL, NO la consumimos como alias — esto
 * es crítico porque `FROM A JOIN B` sin el chequeo de keyword agarraría
 * `JOIN` como alias de `A` y nunca detectaría a `B`.
 *
 * El alias capture es manual (después del match de FROM/JOIN) en lugar
 * de regex greedy para evitar ese problema.
 */
function extractTableRefs(stripped: string): TableRef[] {
  const refs: TableRef[] = [];
  // Solo captura `FROM/JOIN <table>` (con o sin comillas dobles).
  const re = /\b(?:FROM|JOIN)\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const table = m[1] ?? m[2];
    if (!table) continue;
    // Después del match, intentar leer alias manualmente.
    let alias: string | undefined;
    const rest = stripped.slice(re.lastIndex);
    const aliasMatch =
      /^\s+(?:(AS)\s+)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/i.exec(rest);
    if (aliasMatch) {
      const candidate = aliasMatch[2] ?? aliasMatch[3];
      if (candidate && !ALIAS_BLACKLIST.has(candidate.toUpperCase())) {
        alias = candidate;
      }
    }
    refs.push({ table, alias: alias ?? table });
  }
  return refs;
}

/**
 * Inyecta filtros de tenantId. Para cada tabla BI usada, agrega
 * `"<alias>"."tenantId" = '<id>'` combinado con AND. Si hay alias, lo
 * usa; si no, usa el nombre de tabla quoted. Esto resuelve el problema
 * de ambigüedad cuando hay JOIN entre dos tablas que tienen `tenantId`.
 *
 * El filtro se inyecta en el WHERE de NIVEL SUPERIOR (no dentro de
 * subqueries ni FILTER clauses). Si no hay WHERE, se crea antes de
 * GROUP/ORDER/LIMIT/HAVING/UNION.
 *
 * Importante: solo inyectamos para tablas de la whitelist BI (que tienen
 * `tenantId`). Los CTEs no tienen `tenantId` y NO se les agrega filtro.
 */
function injectTenantFilters(
  sql: string,
  tenantId: string,
  tableRefs: TableRef[],
  cteAliases: string[],
): string {
  if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
    throw new SqlSafetyError(`tenantId con caracteres inválidos.`);
  }

  // Filtrar refs que apunten a tablas BI (tienen tenantId).
  // Los CTEs NO tienen tenantId — si el LLM hizo FROM una CTE, no
  // inyectamos filtro para esa ref. La seguridad del tenantId se garantiza
  // dentro de las CTEs (que también pasan por nosotros) en el siguiente
  // pase si crean más SELECTs — el extractTableRefs ya recorre todo.
  const biRefs = tableRefs.filter((r) => !cteAliases.includes(r.table));
  if (biRefs.length === 0) return sql;

  // Generar los predicados deduplicados por alias.
  const seen = new Set<string>();
  const predicates: string[] = [];
  for (const ref of biRefs) {
    if (seen.has(ref.alias)) continue;
    seen.add(ref.alias);
    predicates.push(`"${ref.alias}"."tenantId" = '${tenantId}'`);
  }
  const tenantClause = predicates.join(' AND ');

  // Buscar el WHERE de NIVEL SUPERIOR.
  const whereIdx = findTopLevelMatch(sql, /\bWHERE\b/i);
  if (whereIdx >= 0) {
    const whereLen = 5; // 'WHERE'
    const idx = whereIdx + whereLen;
    return (
      sql.slice(0, idx) + ` ${tenantClause} AND ` + sql.slice(idx).trimStart()
    );
  }

  // Sin WHERE — insertar antes de la primera cláusula post-FROM.
  const clauseIdx = findTopLevelMatch(
    sql,
    /\b(GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|HAVING|UNION|FETCH)\b/i,
  );
  if (clauseIdx >= 0) {
    return (
      sql.slice(0, clauseIdx).trimEnd() +
      ` WHERE ${tenantClause} ` +
      sql.slice(clauseIdx)
    );
  }
  return sql.trimEnd() + ` WHERE ${tenantClause}`;
}

/**
 * Inyecta `LIMIT N` si el SQL no tiene LIMIT explícito. Respeta OFFSET
 * y el caso donde ya hay LIMIT (lo deja como está).
 */
function injectLimitIfMissing(sql: string, limit = DEFAULT_SQL_LIMIT): string {
  if (/\bLIMIT\b/i.test(sql)) return sql;
  return sql.trimEnd() + ` LIMIT ${limit}`;
}

/**
 * Resultado del análisis. `sanitized` es el SQL listo para ejecutar.
 */
export interface SanitizeResult {
  sanitized: string;
  tablesUsed: string[];
  injectedTenantFilter: boolean;
  injectedLimit: boolean;
}

/**
 * Pipeline completa. Lanza SqlSafetyError con mensaje pedagógico si algo
 * falla — el service lo manda como tool_result error al LLM para que
 * corrija.
 */
export function sanitizeBiSql(
  rawSql: string,
  tenantId: string,
): SanitizeResult {
  if (typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    throw new SqlSafetyError('SQL vacío.');
  }
  if (rawSql.length > 4000) {
    throw new SqlSafetyError(
      'SQL demasiado largo (>4000 chars). Simplifica la consulta.',
    );
  }
  const stripped = stripCommentsAndStrings(rawSql);

  // 1. No statement separators.
  if (stripped.includes(';')) {
    throw new SqlSafetyError(
      'No se permiten múltiples statements (`;`). Una sola consulta SELECT por llamada.',
    );
  }

  // 2. Debe ser SELECT — primer keyword después de comments/strings.
  if (!/^\s*(WITH|SELECT)\b/i.test(stripped)) {
    throw new SqlSafetyError(
      'Solo se permiten consultas SELECT (con o sin CTE WITH). No se ejecutarán INSERTs ni mutaciones.',
    );
  }

  // 3. Sin keywords destructivas.
  const blocked = BLOCKED_KEYWORDS_RE.exec(stripped);
  if (blocked) {
    throw new SqlSafetyError(
      `Keyword no permitida: "${blocked[1].toUpperCase()}". Solo SELECT contra el warehouse BI.`,
    );
  }

  // 4. Whitelist de tablas. Los CTEs (WITH ... AS) definen tablas
  //    temporales que el SELECT puede referenciar — las sumamos a la
  //    lista permitida para este SQL.
  const tableRefs = extractTableRefs(stripped);
  if (tableRefs.length === 0) {
    throw new SqlSafetyError(
      'No se detectó ninguna tabla en el FROM. Asegúrate de hacer FROM "BiPrestamo" / "BiAgencia" / etc.',
    );
  }
  const cteAliases = extractCteAliases(stripped);
  const allowed = new Set<string>([...BI_WHITELIST_TABLES, ...cteAliases]);
  const outsiders = tableRefs.filter((r) => !allowed.has(r.table));
  if (outsiders.length > 0) {
    throw new SqlSafetyError(
      `Tabla(s) fuera de la whitelist: ${outsiders.map((r) => r.table).join(', ')}. ` +
        `Solo se permiten: ${BI_WHITELIST_TABLES.join(', ')}.`,
    );
  }
  // De las tablas referenciadas, dejar solo las del warehouse — los CTEs
  // se reportan por separado a futuro si hace falta.
  const realTables = [
    ...new Set(
      tableRefs
        .filter((r) => !cteAliases.includes(r.table))
        .map((r) => r.table),
    ),
  ];

  // 5. Inyectar tenantId y LIMIT.
  const hadTenant = /"tenantId"/i.test(stripped);
  let out = injectTenantFilters(rawSql, tenantId, tableRefs, cteAliases);
  const hadLimit = /\bLIMIT\b/i.test(out);
  out = injectLimitIfMissing(out);

  return {
    sanitized: out,
    tablesUsed: realTables,
    injectedTenantFilter: !hadTenant,
    injectedLimit: !hadLimit,
  };
}
