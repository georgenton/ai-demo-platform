import { describe, expect, it } from 'vitest';

import { normalizeAgentSql } from './normalize-agent-sql.js';

describe('normalizeAgentSql', () => {
  it('normaliza tablas académicas en minúscula después de FROM/JOIN', () => {
    const sql =
      'SELECT COUNT(*) AS total FROM student s JOIN enrollment e ON e."studentId" = s.id';

    expect(normalizeAgentSql(sql)).toBe(
      'SELECT COUNT(*) AS total FROM "Student" s JOIN "Enrollment" e ON e."studentId" = s.id',
    );
  });

  it('acepta plurales comunes emitidos por modelos text-to-SQL', () => {
    const sql =
      'SELECT c.name FROM courses c JOIN grades g ON g."enrollmentId" = c.id';

    expect(normalizeAgentSql(sql)).toBe(
      'SELECT c.name FROM "Course" c JOIN "Grade" g ON g."enrollmentId" = c.id',
    );
  });

  it('no toca identificadores ya citados ni columnas camelCase', () => {
    const sql =
      'SELECT "createdAt", "studentId" FROM "Enrollment" WHERE "createdAt" > now()';

    expect(normalizeAgentSql(sql)).toBe(sql);
  });

  it('no reescribe CTEs que se llamen como una tabla académica', () => {
    const sql =
      'WITH student AS (SELECT id FROM "Student") SELECT COUNT(*) FROM student';

    expect(normalizeAgentSql(sql)).toBe(sql);
  });

  it('normaliza fechas ISO usadas por error como term académico', () => {
    const sql =
      'SELECT c.name, COUNT(e.id) AS enrollment_count FROM "Course" c JOIN "Enrollment" e ON c.id = e."courseId" WHERE e.term = \'2025-01-01\' GROUP BY c.name ORDER BY enrollment_count DESC LIMIT 1';

    expect(normalizeAgentSql(sql)).toBe(
      'SELECT c.name, COUNT(e.id) AS enrollment_count FROM "Course" c JOIN "Enrollment" e ON c.id = e."courseId" WHERE e.term = \'2025-1\' GROUP BY c.name ORDER BY enrollment_count DESC LIMIT 1',
    );
  });

  it('convierte fechas de segundo semestre a term YYYY-2', () => {
    const sql =
      "SELECT COUNT(*) FROM enrollment e WHERE e.term IN ('2025-01-01', '2025-07-01')";

    expect(normalizeAgentSql(sql)).toBe(
      "SELECT COUNT(*) FROM \"Enrollment\" e WHERE e.term IN ('2025-1', '2025-2')",
    );
  });

  it('cita columnas camelCase cuando el modelo las emite como alias.courseId', () => {
    const sql =
      'SELECT c.name FROM "Enrollment" e JOIN "Course" c ON e.courseId = c.id JOIN grade g ON g.enrollmentId = e.id';

    expect(normalizeAgentSql(sql)).toBe(
      'SELECT c.name FROM "Enrollment" e JOIN "Course" c ON e."courseId" = c.id JOIN "Grade" g ON g."enrollmentId" = e.id',
    );
  });

  it('quita LOWER() alrededor de examType porque es enum en Postgres', () => {
    const sql =
      'SELECT COUNT(*) FROM "Grade" g WHERE LOWER(g."examType") = \'final\'';

    expect(normalizeAgentSql(sql)).toBe(
      'SELECT COUNT(*) FROM "Grade" g WHERE g."examType" = \'final\'',
    );
  });
});
