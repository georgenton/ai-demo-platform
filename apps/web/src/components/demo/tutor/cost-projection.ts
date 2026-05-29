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

// -----------------------------------------------------------------------------
// Proyección mensual genérica (Demos 01-04)
//
// Modelo más simple que la proyección semestre del tutor: una sola unidad
// "uso" (consulta / comparación / búsqueda / query) con dos parámetros
// editables: cuántos usuarios activos hay y cuántos usos hace cada uno al
// mes. Los tokens por uso vienen de la sesión actual o de un valor de
// referencia conservador cuando todavía no hay sesión.
//
// Por qué no usamos "documentos" como dimensión: el costo mensual de
// Anthropic NO escala linealmente con cuántos PDFs hay indexados — el
// embedding inicial se paga una vez. Lo que se factura mes a mes es cada
// consulta del usuario, y eso es lo que esta fórmula cuenta.
// -----------------------------------------------------------------------------

/** Parámetros editables del cost projection mensual. */
export interface MonthlyProjectionParams {
  /** Número de usuarios activos al mes. */
  users: number;
  /** Cantidad de "usos" (consultas / comparaciones / etc.) por usuario al mes. */
  usesPerUserPerMonth: number;
}

export interface MonthlyCostBreakdown {
  /** Total de usos en el mes (users × usesPerUserPerMonth). */
  monthlyUses: number;
  /** Tokens totales del mes (monthlyUses × tokensPerUse total). */
  monthlyTokens: number;
  /** USD mensuales según el pricing pasado. */
  monthlyCostUsd: number;
}

/**
 * Calcula el costo mensual proyectado para un demo.
 *
 * `tokensPerUse` es el promedio de tokens (input + output) de UN uso. Lo
 * provee el caller, que decide si lo toma de la sesión actual (cuando ya
 * hay datos) o del valor de referencia conservador (cuando la sesión
 * todavía está vacía).
 */
export function projectMonthlyCost(
  tokensPerUse: TutorUsage,
  params: MonthlyProjectionParams,
  pricing: Pick<
    TutorProviderPricing,
    'pricePerMillionInput' | 'pricePerMillionOutput'
  >,
): MonthlyCostBreakdown {
  const monthlyUses = Math.max(0, params.users * params.usesPerUserPerMonth);
  const perUseUsd = costOfSession(tokensPerUse, pricing);
  const monthlyCostUsd = perUseUsd * monthlyUses;
  const monthlyTokens =
    (tokensPerUse.inputTokens + tokensPerUse.outputTokens) * monthlyUses;
  return { monthlyUses, monthlyTokens, monthlyCostUsd };
}
