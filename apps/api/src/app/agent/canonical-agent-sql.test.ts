import { describe, expect, it } from 'vitest';

import { canonicalAgentSqlForQuestion } from './canonical-agent-sql.js';

describe('canonicalAgentSqlForQuestion', () => {
  it.each([
    '¿Cuántos estudiantes hay en total?',
    '¿Cuál es la materia con más inscripciones este semestre?',
    '¿Cuántos estudiantes reprobaron Cálculo II en 2025-1?',
    '¿Quién tiene el mejor promedio del semestre actual?',
    '¿Cuántas materias cursa un estudiante en promedio?',
    '¿Hay materias donde la mayoría aprobó parciales pero reprobó el final?',
  ])('devuelve SQL canónico para la sugerencia: %s', (question) => {
    expect(canonicalAgentSqlForQuestion(question)).toMatch(/SELECT|WITH/i);
  });

  it('normaliza acentos, puntuación y guiones al detectar la pregunta', () => {
    expect(
      canonicalAgentSqlForQuestion(
        'Cuantos estudiantes reprobaron Calculo II en 2025-1',
      ),
    ).toContain('Cálculo II');
  });

  it('devuelve null para preguntas libres', () => {
    expect(canonicalAgentSqlForQuestion('Dame los tres mejores cursos')).toBe(
      null,
    );
  });
});
