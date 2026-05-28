// -----------------------------------------------------------------------------
// Cost engine — funciones puras de proyección de costo del Demo 05.
//
// Sin estado, sin DB, sin red. Toma tokens medidos + parámetros de uso
// (estudiantes, sesiones, semanas) y devuelve costos extrapolados.
//
// La separación "session math" / "projection math" deja el código fácil de
// testear: `costOfSession` se prueba con valores chicos y predecibles;
// `projectSemesterCost` se prueba como combinación de los dos.
//
// Por qué no consulta al PROVIDERS directamente: para hacer el engine
// fácilmente testeable con pricing falso. El caller (tutor.service) inyecta
// el precio. En la UI también se va a permitir editar precios para "qué
// pasa si Anthropic sube X%".
// -----------------------------------------------------------------------------

import type { ProviderPricing } from './pricing.constants.js';

/** Tokens de un único turn (par usuario→tutor). */
export interface SessionTokens {
  inputTokens: number;
  outputTokens: number;
}

/** Parámetros de extrapolación. Espejo de los inputs editables del panel 3. */
export interface ProjectionParams {
  /** Número de estudiantes que usan el tutor. */
  students: number;
  /** Sesiones por semana por estudiante. */
  sessionsPerWeek: number;
  /** Semanas del semestre académico. */
  weeksInSemester: number;
}

/** Resultado del cálculo para un provider dado. */
export interface ProviderCostBreakdown {
  /** USD que cobraría el provider por una sesión (los tokens medidos). */
  perSessionUsd: number;
  /** USD totales extrapolados (perSession × students × sessions × weeks). */
  semesterTotalUsd: number;
  /** Tokens totales del semestre proyectado (in + out). */
  semesterTotalTokens: number;
}

/**
 * Costo en USD de UNA sesión medida, según el pricing del provider.
 *
 * Pricing está expresado en USD/1.000.000 tokens; multiplicamos por
 * (tokens / 1_000_000) por cada bucket (input/output) y sumamos.
 */
export function costOfSession(
  tokens: SessionTokens,
  pricing: Pick<
    ProviderPricing,
    'pricePerMillionInput' | 'pricePerMillionOutput'
  >,
): number {
  const inUsd = (tokens.inputTokens / 1_000_000) * pricing.pricePerMillionInput;
  const outUsd =
    (tokens.outputTokens / 1_000_000) * pricing.pricePerMillionOutput;
  return inUsd + outUsd;
}

/**
 * Extrapola el costo de una sesión a un semestre completo.
 *
 * Asunción: cada sesión consume aproximadamente los mismos tokens que la
 * sesión de muestra. Es una aproximación deliberadamente conservadora —
 * sesiones más largas consumen más; el demo deja al usuario subir/bajar el
 * número de sesiones para compensar.
 */
export function projectSemesterCost(
  sampleTokens: SessionTokens,
  params: ProjectionParams,
  pricing: Pick<
    ProviderPricing,
    'pricePerMillionInput' | 'pricePerMillionOutput'
  >,
): ProviderCostBreakdown {
  const sessionsTotal =
    params.students * params.sessionsPerWeek * params.weeksInSemester;
  const perSessionUsd = costOfSession(sampleTokens, pricing);
  const semesterTotalUsd = perSessionUsd * sessionsTotal;
  const semesterTotalTokens =
    (sampleTokens.inputTokens + sampleTokens.outputTokens) * sessionsTotal;
  return {
    perSessionUsd,
    semesterTotalUsd,
    semesterTotalTokens,
  };
}

/**
 * Versión multi-provider: corre la proyección contra varios proveedores y
 * devuelve un map id → breakdown. El frontend usa esto para pintar la tabla
 * comparativa.
 */
export function projectCostAcrossProviders(
  sampleTokens: SessionTokens,
  params: ProjectionParams,
  providers: readonly ProviderPricing[],
): Record<string, ProviderCostBreakdown> {
  const out: Record<string, ProviderCostBreakdown> = {};
  for (const p of providers) {
    out[p.id] = projectSemesterCost(sampleTokens, params, p);
  }
  return out;
}
