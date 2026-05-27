// -----------------------------------------------------------------------------
// Schema accesible del agente (Demo 04) — fuente de verdad de la columna
// derecha de la consola.
//
// Decisión: usamos los tipos sintéticos del kit ('uuid', 'timestamp',
// 'numeric') en vez de los tipos técnicos reales ('text', 'timestamp(3)',
// 'double precision'). Razón: esta card es vendor-facing — el cliente lee
// "uuid" y entiende, mientras que "text" + un CUID le suena raro. El
// SafeSqlExecutor del backend ya enforcea que esas 4 tablas son las únicas
// accesibles; la diferencia visual entre tipos sintéticos y reales no
// afecta la seguridad (que sigue siendo a nivel motor + allowlist).
// -----------------------------------------------------------------------------

export interface SchemaColumn {
  name: string;
  type: string;
}

export interface SchemaTableDef {
  name: string;
  columns: SchemaColumn[];
}

/** Las 4 tablas que el SafeSqlExecutor del backend permite consultar. */
export const AGENT_SCHEMA: readonly SchemaTableDef[] = [
  {
    name: 'Course',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'code', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'credits', type: 'int' },
    ],
  },
  {
    name: 'Student',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'fullName', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'enrolledAt', type: 'timestamp' },
    ],
  },
  {
    name: 'Enrollment',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'studentId', type: 'uuid' },
      { name: 'courseId', type: 'uuid' },
      { name: 'term', type: 'text' },
      { name: 'status', type: 'enum' },
    ],
  },
  {
    name: 'Grade',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'enrollmentId', type: 'uuid' },
      { name: 'examType', type: 'text' },
      { name: 'score', type: 'numeric' },
    ],
  },
] as const;
