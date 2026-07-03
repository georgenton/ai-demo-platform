// -----------------------------------------------------------------------------
// Normalización acotada para el Demo 04 (agente con datos).
//
// El modelo SQL local a veces devuelve nombres de tablas en minúscula
// (`student`, `enrollment`) aunque el schema Prisma/Postgres real usa
// identificadores citados y case-sensitive (`"Student"`, `"Enrollment"`).
// Antes de ejecutar, corregimos referencias de tabla después de FROM/JOIN
// contra el schema académico cerrado y un caso frecuente de término académico:
// `term = '2025-01-01'` cuando el dato real es `term = '2025-1'`. La validación
// fuerte sigue viviendo en SafeSqlExecutor.
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

  const normalizedTables = sql.replace(
    /\b(FROM|JOIN)\s+(?!")([A-Za-z_][A-Za-z0-9_]*)(?=\b)/gi,
    (match, keyword: string, tableName: string) => {
      const lower = tableName.toLowerCase();
      if (cteAliases.has(lower)) return match;

      const canonical = ACADEMIC_TABLE_ALIASES.get(lower);
      if (!canonical) return match;

      return `${keyword} "${canonical}"`;
    },
  );
  return normalizeAcademicTermLiterals(normalizedTables);
}

function normalizeAcademicTermLiterals(sql: string): string {
  const termRef = String.raw`(?:(?:"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)\.)?"?term"?`;
  const singleValueRe = new RegExp(
    String.raw`\b(${termRef})\s*=\s*'(\d{4})-(\d{2})-\d{2}'`,
    'gi',
  );
  const inListRe = new RegExp(
    String.raw`\b(${termRef})\s+IN\s*\(([^)]*)\)`,
    'gi',
  );

  return sql
    .replace(
      singleValueRe,
      (_match, lhs: string, year: string, month: string) => {
        return `${lhs} = '${academicTermFromDate(year, month)}'`;
      },
    )
    .replace(inListRe, (match, lhs: string, values: string) => {
      const normalizedValues = values.replace(
        /'(\d{4})-(\d{2})-\d{2}'/g,
        (_valueMatch, year: string, month: string) =>
          `'${academicTermFromDate(year, month)}'`,
      );
      return normalizedValues === values
        ? match
        : `${lhs} IN (${normalizedValues})`;
    });
}

function academicTermFromDate(year: string, month: string): string {
  return `${year}-${Number(month) <= 6 ? '1' : '2'}`;
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
