// -----------------------------------------------------------------------------
// Tests del cost engine. Funciones puras → tests determinísticos.
//
// Lo que verificamos:
//   - costOfSession: la fórmula USD/M aplicada bien por bucket input/output.
//   - projectSemesterCost: extrapolación = perSession × students × sesiones × sem.
//   - projectCostAcrossProviders: shape correcto + cada provider corre el cálculo.
//
// No verificamos contra PROVIDERS reales (ese pricing puede cambiar);
// usamos fixtures con números redondos que hacen las multiplicaciones obvias.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  costOfSession,
  projectCostAcrossProviders,
  projectSemesterCost,
  type ProjectionParams,
  type SessionTokens,
} from './cost-engine.js';
import type { ProviderPricing } from './pricing.constants.js';

/** Fixture: pricing $1/M input + $10/M output — números fáciles de chequear. */
const CHEAP: Pick<
  ProviderPricing,
  'pricePerMillionInput' | 'pricePerMillionOutput'
> = {
  pricePerMillionInput: 1,
  pricePerMillionOutput: 10,
};

describe('costOfSession', () => {
  it('aplica el pricing por bucket (1M tokens input + 1M output)', () => {
    const tokens: SessionTokens = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    };
    // 1M × $1/M = $1 input; 1M × $10/M = $10 output → total $11.
    expect(costOfSession(tokens, CHEAP)).toBe(11);
  });

  it('escala lineal: 10K tokens es 1/100 de 1M', () => {
    const tokens: SessionTokens = {
      inputTokens: 10_000,
      outputTokens: 10_000,
    };
    // 0.01 × $1 + 0.01 × $10 = $0.11
    expect(costOfSession(tokens, CHEAP)).toBeCloseTo(0.11, 10);
  });

  it('si todos los tokens son 0 el costo es 0', () => {
    expect(costOfSession({ inputTokens: 0, outputTokens: 0 }, CHEAP)).toBe(0);
  });
});

describe('projectSemesterCost', () => {
  const SAMPLE: SessionTokens = { inputTokens: 1_000, outputTokens: 2_000 };
  const PARAMS: ProjectionParams = {
    students: 100,
    sessionsPerWeek: 2,
    weeksInSemester: 16,
  };

  it('calcula sessions totales como students × sessions × weeks', () => {
    const result = projectSemesterCost(SAMPLE, PARAMS, CHEAP);
    // 100 × 2 × 16 = 3200 sesiones totales.
    // Tokens totales = (1000 + 2000) × 3200 = 9.6M tokens.
    expect(result.semesterTotalTokens).toBe(9_600_000);
  });

  it('extrapola el costo per-session al total', () => {
    // Per session: 1K × $1/M + 2K × $10/M = $0.001 + $0.02 = $0.021
    // Total: $0.021 × 3200 = $67.2
    const result = projectSemesterCost(SAMPLE, PARAMS, CHEAP);
    expect(result.perSessionUsd).toBeCloseTo(0.021, 10);
    expect(result.semesterTotalUsd).toBeCloseTo(67.2, 6);
  });

  it('cero estudiantes → total cero (no crashea por división)', () => {
    const result = projectSemesterCost(
      SAMPLE,
      { ...PARAMS, students: 0 },
      CHEAP,
    );
    expect(result.semesterTotalUsd).toBe(0);
    expect(result.semesterTotalTokens).toBe(0);
  });
});

describe('projectCostAcrossProviders', () => {
  it('devuelve breakdown por cada provider keyed por id', () => {
    const providers: ProviderPricing[] = [
      {
        id: 'cheap',
        displayName: 'Cheap',
        modelTier: '',
        pricePerMillionInput: 1,
        pricePerMillionOutput: 10,
        capturedAt: '2026-01-01',
        sourceUrl: 'https://example.com',
      },
      {
        id: 'expensive',
        displayName: 'Expensive',
        modelTier: '',
        pricePerMillionInput: 5,
        pricePerMillionOutput: 50,
        capturedAt: '2026-01-01',
        sourceUrl: 'https://example.com',
      },
    ];
    const result = projectCostAcrossProviders(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      { students: 1, sessionsPerWeek: 1, weeksInSemester: 1 },
      providers,
    );
    expect(Object.keys(result).sort()).toEqual(['cheap', 'expensive']);
    expect(result.cheap.semesterTotalUsd).toBe(11);
    expect(result.expensive.semesterTotalUsd).toBe(55);
  });
});
