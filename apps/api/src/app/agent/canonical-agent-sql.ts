// -----------------------------------------------------------------------------
// SQL canónico para las preguntas sugeridas del Demo 04.
//
// Estas 6 preguntas son botones de demo, no entrada arbitraria. Para que el
// smoke sea repetible con Anthropic y modelos locales más pequeños, resolvemos
// esas intenciones conocidas a SQL determinística y dejamos al LLM narrar el
// resultado ya ejecutado.
// -----------------------------------------------------------------------------

const CURRENT_TERM = '2025-2';

const CANONICAL_SQL_BY_QUESTION = new Map<string, string>([
  [
    'cuantos estudiantes hay en total',
    'SELECT COUNT(*) AS total_estudiantes FROM "Student"',
  ],
  [
    'cual es la materia con mas inscripciones este semestre',
    `SELECT
  c.name AS materia,
  c.code AS codigo,
  COUNT(e.id) AS total_inscripciones
FROM "Enrollment" e
JOIN "Course" c ON e."courseId" = c.id
WHERE e.term = '${CURRENT_TERM}'
GROUP BY c.id, c.name, c.code
ORDER BY total_inscripciones DESC
LIMIT 1`,
  ],
  [
    'cuantos estudiantes reprobaron calculo ii en 2025 1',
    `SELECT
  COUNT(DISTINCT e."studentId") AS estudiantes_reprobados
FROM "Enrollment" e
JOIN "Course" c ON e."courseId" = c.id
JOIN "Grade" g ON g."enrollmentId" = e.id
WHERE e.term = '2025-1'
  AND c.name = 'Cálculo II'
  AND g."examType" = 'final'
  AND g.score < 60`,
  ],
  [
    'quien tiene el mejor promedio del semestre actual',
    `SELECT
  s."fullName" AS estudiante,
  CAST(AVG(g.score) AS NUMERIC(10, 2)) AS promedio
FROM "Student" s
JOIN "Enrollment" e ON e."studentId" = s.id
JOIN "Grade" g ON g."enrollmentId" = e.id
WHERE e.term = '${CURRENT_TERM}'
GROUP BY s.id, s."fullName"
ORDER BY promedio DESC
LIMIT 1`,
  ],
  [
    'cuantas materias cursa un estudiante en promedio',
    `SELECT
  COUNT(*) AS total_inscripciones,
  COUNT(DISTINCT "studentId") AS total_estudiantes,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT "studentId"), 0), 2) AS promedio_materias
FROM "Enrollment"`,
  ],
  [
    'hay materias donde la mayoria aprobo parciales pero reprobo el final',
    `WITH student_performance AS (
  SELECT
    e."courseId",
    e.id AS enrollment_id,
    MAX(CASE WHEN g."examType" = 'parcial-1' THEN g.score END) AS parcial1_score,
    MAX(CASE WHEN g."examType" = 'parcial-2' THEN g.score END) AS parcial2_score,
    MAX(CASE WHEN g."examType" = 'final' THEN g.score END) AS final_score
  FROM "Enrollment" e
  JOIN "Grade" g ON g."enrollmentId" = e.id
  GROUP BY e."courseId", e.id
),
course_stats AS (
  SELECT
    sp."courseId",
    c.code AS codigo,
    c.name AS materia,
    COUNT(*) AS total_estudiantes,
    SUM(CASE WHEN parcial1_score >= 60 AND parcial2_score >= 60 AND final_score < 60 THEN 1 ELSE 0 END) AS aprobaron_parciales_reprobaron_final
  FROM student_performance sp
  JOIN "Course" c ON c.id = sp."courseId"
  WHERE parcial1_score IS NOT NULL
    AND parcial2_score IS NOT NULL
    AND final_score IS NOT NULL
  GROUP BY sp."courseId", c.code, c.name
)
SELECT
  codigo,
  materia,
  total_estudiantes,
  aprobaron_parciales_reprobaron_final,
  ROUND(100.0 * aprobaron_parciales_reprobaron_final / NULLIF(total_estudiantes, 0), 1) AS porcentaje
FROM course_stats
WHERE aprobaron_parciales_reprobaron_final > total_estudiantes / 2.0
ORDER BY porcentaje DESC`,
  ],
]);

export function canonicalAgentSqlForQuestion(question: string): string | null {
  const key = normalizeQuestion(question);
  return CANONICAL_SQL_BY_QUESTION.get(key) ?? null;
}

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,:;'"`´()[\]{}]/g, ' ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
