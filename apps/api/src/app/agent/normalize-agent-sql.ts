// -----------------------------------------------------------------------------
// Normalización acotada para el Demo 04 (agente con datos).
//
// El modelo SQL local a veces devuelve nombres de tablas en minúscula
// (`student`, `enrollment`) aunque el schema Prisma/Postgres real usa
// identificadores citados y case-sensitive (`"Student"`, `"Enrollment"`).
// Antes de ejecutar, corregimos únicamente referencias de tabla después de
// FROM/JOIN contra el schema académico cerrado. No tocamos columnas, aliases ni
// literales; la validación fuerte sigue viviendo en SafeSqlExecutor.
// -----------------------------------------------------------------------------

const ACADEMIC_TABLE_ALIASES = new Map<string, string>([
  ['course', 'Course'],
  ['courses', 'Course'],
  ['student', 'Student'],
  ['students', 'Student'],
  ['enrollment', 'Enrollment'],
  ['enrollments', 'Enrollment'],
  ['grade', 'Grade'],
  ['grades', 'Grade'],
]);

/**
 * Normaliza referencias de tabla académicas no citadas.
 *
 * Ejemplo:
 *   FROM student s JOIN enrollment e
 *   → FROM "Student" s JOIN "Enrollment" e
 */
export function normalizeAgentSql(sql: string): string {
  const cteAliases = extractCteAliases(sql);

  return sql.replace(
    /\b(FROM|JOIN)\s+(?!")([A-Za-z_][A-Za-z0-9_]*)(?=\b)/gi,
    (match, keyword: string, tableName: string) => {
      const lower = tableName.toLowerCase();
      if (cteAliases.has(lower)) return match;

      const canonical = ACADEMIC_TABLE_ALIASES.get(lower);
      if (!canonical) return match;

      return `${keyword} "${canonical}"`;
    },
  );
}

function extractCteAliases(sql: string): Set<string> {
  if (!/^\s*WITH\b/i.test(sql)) return new Set();

  const aliases = new Set<string>();
  const re = /(?:WITH|,)\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s+AS\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const name = match[1] ?? match[2];
    if (name) aliases.add(name.toLowerCase());
  }
  return aliases;
}
