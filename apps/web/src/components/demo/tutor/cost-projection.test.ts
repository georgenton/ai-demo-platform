// Tests del cost projection del frontend.
// Mismo set que el backend pero contra la implementación TS del browser —
// tripwire si las dos fórmulas divergen.

import { describe, expect, it } from 'vitest';

import { costOfSession, projectSemesterCost } from './cost-projection';

const CHEAP = { pricePerMillionInput: 1, pricePerMillionOutput: 10 };

describe('costOfSession', () => {
  it('1M input + 1M output con pricing $1/$10 → $11', () => {
    expect(
      costOfSession({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, CHEAP),
    ).toBe(11);
  });

  it('0 tokens → $0', () => {
    expect(costOfSession({ inputTokens: 0, outputTokens: 0 }, CHEAP)).toBe(0);
  });
});

describe('projectSemesterCost', () => {
  it('1K + 2K tokens × 100 estudiantes × 2 sesiones × 16 sem → $67.2', () => {
    const result = projectSemesterCost(
      { inputTokens: 1_000, outputTokens: 2_000 },
      { students: 100, sessionsPerWeek: 2, weeksInSemester: 16 },
      CHEAP,
    );
    expect(result.perSessionUsd).toBeCloseTo(0.021, 10);
    expect(result.semesterTotalUsd).toBeCloseTo(67.2, 6);
    expect(result.semesterTotalTokens).toBe(9_600_000);
  });

  it('students=0 → todo en 0 (sin division por cero)', () => {
    const result = projectSemesterCost(
      { inputTokens: 1_000, outputTokens: 2_000 },
      { students: 0, sessionsPerWeek: 2, weeksInSemester: 16 },
      CHEAP,
    );
    expect(result.semesterTotalUsd).toBe(0);
    expect(result.semesterTotalTokens).toBe(0);
  });
});
