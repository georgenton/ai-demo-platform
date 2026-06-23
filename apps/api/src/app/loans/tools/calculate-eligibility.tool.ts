// -----------------------------------------------------------------------------
// Tool `calculate_loan_eligibility` — usada en etapa `credit_evaluation`.
// Calcula la elegibilidad del préstamo aplicando reglas básicas de una
// CAC ecuatoriana típica:
//
//   1. Si el socio tiene un préstamo activo (hasActiveLoan) → rechazo.
//   2. Si el score interno < 500 → rechazo.
//   3. Si el aporte de capital del socio < $20 → rechazo (requisito SEPS).
//   4. Cuota mensual al monto solicitado / ingreso mensual > 40% → contra-oferta.
//   5. Score 500-650 + ingreso menor a $1000 → tasa más alta (16%), monto recortado.
//   6. Score 650+ + ingreso > $1000 → tasa estándar (14%), monto completo.
//
// La calculadora NO consulta el core — recibe los datos del LLM, que a su
// vez los obtuvo via `consult_core_banking` previamente. Esto permite que
// el LLM negocie ("¿y si te ofrezco $X en vez de $Y?") sin volver al core.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import type { EligibilityResult } from '../dto/loans.dto.js';

export const CALCULATE_LOAN_ELIGIBILITY_TOOL: ChatTool = {
  name: 'calculate_loan_eligibility',
  description:
    'Calcula si el préstamo solicitado es aprobable bajo las políticas de la cooperativa. ' +
    'Recibe el snapshot crediticio del socio (de consult_core_banking) + el monto/plazo solicitados. ' +
    'Devuelve veredicto (eligible o no), monto máximo aprobable, tasa sugerida, cuota mensual estimada y ratio cuota/ingreso. ' +
    'LLAMAR después de tener todos los datos: monto, plazo, score, ingreso, deudas, aporte y si tiene préstamo activo.',
  inputSchema: {
    type: 'object',
    properties: {
      requestedAmountUsd: {
        type: 'number',
        description: 'Monto solicitado por el socio en USD (ej. 2500).',
      },
      termMonths: {
        type: 'number',
        description:
          'Plazo del préstamo en meses (típico CAC: 6, 12, 24, 36, 48).',
      },
      internalScore: {
        type: 'number',
        description:
          'Score interno de la cooperativa (0-1000), traído de consult_core_banking.',
      },
      monthlyIncomeUsd: {
        type: 'number',
        description: 'Ingreso mensual del socio en USD.',
      },
      monthlyDebtUsd: {
        type: 'number',
        description:
          'Suma de cuotas mensuales de otras deudas del socio en USD.',
      },
      shareCapitalUsd: {
        type: 'number',
        description:
          'Aporte de capital actual del socio en USD (de consult_core_banking).',
      },
      hasActiveLoan: {
        type: 'boolean',
        description:
          'true si el socio ya tiene un préstamo en estado servicing.',
      },
    },
    required: [
      'requestedAmountUsd',
      'termMonths',
      'internalScore',
      'monthlyIncomeUsd',
      'monthlyDebtUsd',
      'shareCapitalUsd',
      'hasActiveLoan',
    ],
  },
};

export interface CalculateEligibilityInput {
  requestedAmountUsd: number;
  termMonths: number;
  internalScore: number;
  monthlyIncomeUsd: number;
  monthlyDebtUsd: number;
  shareCapitalUsd: number;
  hasActiveLoan: boolean;
}

export function parseCalculateEligibilityInput(
  input: unknown,
): CalculateEligibilityInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<CalculateEligibilityInput>;
  const required: Array<keyof CalculateEligibilityInput> = [
    'requestedAmountUsd',
    'termMonths',
    'internalScore',
    'monthlyIncomeUsd',
    'monthlyDebtUsd',
    'shareCapitalUsd',
  ];
  for (const k of required) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k] as number)) {
      return { error: `${String(k)} inválido — debe ser un número finito.` };
    }
  }
  if (typeof o.hasActiveLoan !== 'boolean') {
    return { error: 'hasActiveLoan inválido — debe ser true o false.' };
  }
  if ((o.termMonths ?? 0) <= 0 || (o.termMonths ?? 0) > 120) {
    return { error: 'termMonths fuera de rango — usar 1..120 meses.' };
  }
  if ((o.requestedAmountUsd ?? 0) <= 0) {
    return { error: 'requestedAmountUsd debe ser mayor a 0.' };
  }
  return o as CalculateEligibilityInput;
}

/**
 * Calcula la cuota mensual con fórmula de amortización francesa
 * (cuota fija). r es la tasa MENSUAL en decimal (no anual).
 *
 *   cuota = P * r / (1 - (1 + r)^-n)
 *
 * Si r == 0 (caso degenerado), devuelve P/n.
 */
function monthlyPayment(
  principal: number,
  annualRate: number,
  n: number,
): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

const MIN_SHARE_CAPITAL_USD = 20;
const MIN_SCORE = 500;
const PAYMENT_TO_INCOME_LIMIT = 0.4;

/**
 * Ejecuta las 6 reglas. Determinístico — input mismo → output mismo.
 * Tests pueden fijar input y verificar veredicto sin LLM.
 */
export function evaluateEligibility(
  input: CalculateEligibilityInput,
): EligibilityResult {
  // Regla 1: préstamo activo → rechazo automático.
  if (input.hasActiveLoan) {
    return {
      eligible: false,
      verdict: 'No elegible por préstamo activo',
      reason:
        'El socio ya tiene un préstamo vigente. Debe cancelarlo antes de solicitar uno nuevo (política SEPS/CAC).',
      maxAmountUsd: null,
      suggestedRateAnnual: null,
      estimatedMonthlyPayment: null,
      paymentToIncomeRatio: null,
    };
  }

  // Regla 2: score interno mínimo.
  if (input.internalScore < MIN_SCORE) {
    return {
      eligible: false,
      verdict: 'No elegible por score crediticio',
      reason: `El score interno (${input.internalScore}) está por debajo del mínimo requerido (${MIN_SCORE}). Recomendamos consolidar historial crediticio.`,
      maxAmountUsd: null,
      suggestedRateAnnual: null,
      estimatedMonthlyPayment: null,
      paymentToIncomeRatio: null,
    };
  }

  // Regla 3: aporte mínimo.
  if (input.shareCapitalUsd < MIN_SHARE_CAPITAL_USD) {
    return {
      eligible: false,
      verdict: 'No elegible por aporte de capital insuficiente',
      reason: `El aporte de capital ($${input.shareCapitalUsd.toFixed(2)}) está por debajo del mínimo cooperativo ($${MIN_SHARE_CAPITAL_USD}). Pedir al socio aumentar su aporte y volver a aplicar.`,
      maxAmountUsd: null,
      suggestedRateAnnual: null,
      estimatedMonthlyPayment: null,
      paymentToIncomeRatio: null,
    };
  }

  // Determinar tasa según score + ingreso.
  const tasaAnualPct =
    input.internalScore >= 650 && input.monthlyIncomeUsd > 1000 ? 14 : 16;

  const cuotaSolicitada = monthlyPayment(
    input.requestedAmountUsd,
    tasaAnualPct,
    input.termMonths,
  );
  const totalDebtAfter = cuotaSolicitada + input.monthlyDebtUsd;
  const ratio =
    input.monthlyIncomeUsd > 0 ? totalDebtAfter / input.monthlyIncomeUsd : 1;

  // Regla 4: ratio cuota+deudas / ingreso > 40% → contra-oferta.
  if (ratio > PAYMENT_TO_INCOME_LIMIT) {
    // Calcular el monto máximo que SÍ cumple el límite.
    const disposable =
      input.monthlyIncomeUsd * PAYMENT_TO_INCOME_LIMIT - input.monthlyDebtUsd;
    if (disposable <= 0) {
      return {
        eligible: false,
        verdict: 'No elegible — capacidad de pago saturada',
        reason: `Las deudas mensuales actuales ($${input.monthlyDebtUsd.toFixed(2)}) ya superan el 40% del ingreso ($${(input.monthlyIncomeUsd * 0.4).toFixed(2)}). No queda capacidad de pago para una cuota adicional.`,
        maxAmountUsd: null,
        suggestedRateAnnual: tasaAnualPct,
        estimatedMonthlyPayment: null,
        paymentToIncomeRatio: round(ratio, 3),
      };
    }
    // Despejar P: cuota = P * r / (1 - (1+r)^-n)  → P = cuota * (1 - (1+r)^-n) / r
    const r = tasaAnualPct / 100 / 12;
    const maxAmount =
      r === 0
        ? disposable * input.termMonths
        : disposable * ((1 - Math.pow(1 + r, -input.termMonths)) / r);
    return {
      eligible: true,
      verdict: 'Elegible con contra-oferta',
      reason: `El monto solicitado ($${input.requestedAmountUsd.toFixed(2)}) genera una cuota que supera el 40% de tu ingreso. Podemos ofrecerte hasta $${maxAmount.toFixed(2)} al mismo plazo.`,
      maxAmountUsd: maxAmount.toFixed(2),
      suggestedRateAnnual: tasaAnualPct,
      estimatedMonthlyPayment: disposable.toFixed(2),
      paymentToIncomeRatio: round(disposable / input.monthlyIncomeUsd, 3),
    };
  }

  // Reglas 5 y 6: aprobación directa con tasa según perfil.
  return {
    eligible: true,
    verdict: 'Elegible',
    reason: `Cumple los requisitos: score ${input.internalScore}, ingreso $${input.monthlyIncomeUsd.toFixed(2)}, ratio cuota/ingreso ${(ratio * 100).toFixed(1)}%.`,
    maxAmountUsd: input.requestedAmountUsd.toFixed(2),
    suggestedRateAnnual: tasaAnualPct,
    estimatedMonthlyPayment: cuotaSolicitada.toFixed(2),
    paymentToIncomeRatio: round(ratio, 3),
  };
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
