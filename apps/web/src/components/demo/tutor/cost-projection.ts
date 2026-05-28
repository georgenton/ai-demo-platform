// -----------------------------------------------------------------------------
// Cost projection — versión frontend de cost-engine.ts (backend).
//
// Por qué duplicado y no compartido vía un paquete: hoy no hay
// @org/contracts, y el cálculo es matemática chica (10 líneas) sin
// dependencias. Compartir el módulo sería más overhead que beneficio.
// Si el cálculo crece, se extrae a `packages/cost-shared`.
//
// Regla: si la fórmula cambia, actualizar AMBOS lados en el mismo PR. Los
// tests de cada lado son redundantes pero baratos — sirven de tripwire.
// -----------------------------------------------------------------------------

import type { TutorProviderPricing, TutorUsage } from '@/lib/api';

export interface ProjectionParams {
  students: number;
  sessionsPerWeek: number;
  weeksInSemester: number;
}

export interface ProviderCostBreakdown {
  perSessionUsd: number;
  semesterTotalUsd: number;
  semesterTotalTokens: number;
}

/**
 * Costo en USD de UNA sesión según el pricing del provider.
 *
 * Pricing está en USD/1.000.000 tokens; multiplicamos por (tokens / 1_000_000)
 * en cada bucket y sumamos.
 */
export function costOfSession(
  tokens: TutorUsage,
  pricing: Pick<
    TutorProviderPricing,
    'pricePerMillionInput' | 'pricePerMillionOutput'
  >,
): number {
  const inUsd = (tokens.inputTokens / 1_000_000) * pricing.pricePerMillionInput;
  const outUsd =
    (tokens.outputTokens / 1_000_000) * pricing.pricePerMillionOutput;
  return inUsd + outUsd;
}

/** Extrapola el costo de una sesión a un semestre completo. */
export function projectSemesterCost(
  sampleTokens: TutorUsage,
  params: ProjectionParams,
  pricing: Pick<
    TutorProviderPricing,
    'pricePerMillionInput' | 'pricePerMillionOutput'
  >,
): ProviderCostBreakdown {
  const sessionsTotal =
    params.students * params.sessionsPerWeek * params.weeksInSemester;
  const perSessionUsd = costOfSession(sampleTokens, pricing);
  const semesterTotalUsd = perSessionUsd * sessionsTotal;
  const semesterTotalTokens =
    (sampleTokens.inputTokens + sampleTokens.outputTokens) * sessionsTotal;
  return { perSessionUsd, semesterTotalUsd, semesterTotalTokens };
}
