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
});
