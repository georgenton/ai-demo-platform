// Tests del cost projection del frontend.
// Mismo set que el backend pero contra la implementación TS del browser —
// tripwire si las dos fórmulas divergen.

import { describe, expect, it } from 'vitest';

import {
  costOfSession,
  projectMonthlyCost,
  projectSemesterCost,
} from './cost-projection';

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

describe('projectMonthlyCost', () => {
  // 1K input + 2K output con pricing CHEAP ($1/$10 por millón) → $0.021/uso.
  const SAMPLE = { inputTokens: 1_000, outputTokens: 2_000 };

  it('100 usuarios × 50 usos/mes → 5.000 usos, $105/mes', () => {
    const result = projectMonthlyCost(
      SAMPLE,
      { users: 100, usesPerUserPerMonth: 50 },
      CHEAP,
    );
    expect(result.monthlyUses).toBe(5_000);
    // 0.021 × 5000 = 105
    expect(result.monthlyCostUsd).toBeCloseTo(105, 6);
    // (1K + 2K) × 5000 = 15M tokens
    expect(result.monthlyTokens).toBe(15_000_000);
  });

  it('escala lineal con users (10× users → 10× costo)', () => {
    const small = projectMonthlyCost(
      SAMPLE,
      { users: 10, usesPerUserPerMonth: 50 },
      CHEAP,
    );
    const big = projectMonthlyCost(
      SAMPLE,
      { users: 100, usesPerUserPerMonth: 50 },
      CHEAP,
    );
    expect(big.monthlyCostUsd).toBeCloseTo(small.monthlyCostUsd * 10, 6);
  });

  it('users=0 → todo en 0', () => {
    const result = projectMonthlyCost(
      SAMPLE,
      { users: 0, usesPerUserPerMonth: 50 },
      CHEAP,
    );
    expect(result.monthlyUses).toBe(0);
    expect(result.monthlyCostUsd).toBe(0);
    expect(result.monthlyTokens).toBe(0);
  });

  it('usesPerUserPerMonth=0 → todo en 0', () => {
    const result = projectMonthlyCost(
      SAMPLE,
      { users: 100, usesPerUserPerMonth: 0 },
      CHEAP,
    );
    expect(result.monthlyUses).toBe(0);
    expect(result.monthlyCostUsd).toBe(0);
  });

  it('inputs negativos por bug → clamp a 0', () => {
    const result = projectMonthlyCost(
      SAMPLE,
      { users: -5, usesPerUserPerMonth: 50 },
      CHEAP,
    );
    expect(result.monthlyUses).toBe(0);
    expect(result.monthlyCostUsd).toBe(0);
  });
});
