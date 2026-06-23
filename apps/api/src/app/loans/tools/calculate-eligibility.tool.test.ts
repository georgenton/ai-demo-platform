// -----------------------------------------------------------------------------
// Tests de `evaluateEligibility` — las 6 reglas de negocio. Lógica pura,
// sin LLM, sin BD. Cada test fija el input y verifica el veredicto.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  evaluateEligibility,
  parseCalculateEligibilityInput,
  type CalculateEligibilityInput,
} from './calculate-eligibility.tool.js';

const BASE: CalculateEligibilityInput = {
  requestedAmountUsd: 2000,
  termMonths: 12,
  internalScore: 700,
  monthlyIncomeUsd: 1500,
  monthlyDebtUsd: 200,
  shareCapitalUsd: 100,
  hasActiveLoan: false,
};

describe('evaluateEligibility — reglas de negocio', () => {
  it('regla 1: hasActiveLoan → rechazo', () => {
    const r = evaluateEligibility({ ...BASE, hasActiveLoan: true });
    expect(r.eligible).toBe(false);
    expect(r.verdict).toMatch(/préstamo activo/i);
    expect(r.maxAmountUsd).toBeNull();
  });

  it('regla 2: score < 500 → rechazo', () => {
    const r = evaluateEligibility({ ...BASE, internalScore: 480 });
    expect(r.eligible).toBe(false);
    expect(r.verdict).toMatch(/score/i);
  });

  it('regla 3: aporte de capital < $20 → rechazo', () => {
    const r = evaluateEligibility({ ...BASE, shareCapitalUsd: 10 });
    expect(r.eligible).toBe(false);
    expect(r.verdict).toMatch(/aporte/i);
  });

  it('regla 4: cuota+deuda > 40% ingreso → contra-oferta', () => {
    // Monto alto a plazo corto + deuda existente → ratio > 40%.
    const r = evaluateEligibility({
      ...BASE,
      requestedAmountUsd: 8000,
      termMonths: 6,
      monthlyDebtUsd: 200,
      monthlyIncomeUsd: 1500,
    });
    expect(r.eligible).toBe(true);
    expect(r.verdict).toMatch(/contra-oferta/i);
    expect(r.maxAmountUsd).not.toBeNull();
    expect(Number(r.maxAmountUsd)).toBeLessThan(8000);
  });

  it('regla 4 bis: capacidad saturada (deudas ya > 40% ingreso) → rechazo', () => {
    const r = evaluateEligibility({
      ...BASE,
      monthlyDebtUsd: 700, // > 40% de 1500 = 600
    });
    expect(r.eligible).toBe(false);
    expect(r.verdict).toMatch(/capacidad de pago/i);
  });

  it('regla 5: score 500-650 + ingreso < $1000 → tasa más alta (16%)', () => {
    const r = evaluateEligibility({
      ...BASE,
      internalScore: 580,
      monthlyIncomeUsd: 900,
      monthlyDebtUsd: 100,
      requestedAmountUsd: 1500,
      termMonths: 24,
    });
    expect(r.eligible).toBe(true);
    expect(r.suggestedRateAnnual).toBe(16);
  });

  it('regla 6: score 650+ + ingreso > $1000 → tasa estándar (14%)', () => {
    const r = evaluateEligibility({
      ...BASE,
      internalScore: 720,
      monthlyIncomeUsd: 1800,
      requestedAmountUsd: 3000,
      termMonths: 24,
    });
    expect(r.eligible).toBe(true);
    expect(r.suggestedRateAnnual).toBe(14);
    expect(r.estimatedMonthlyPayment).not.toBeNull();
  });

  it('cálculo de cuota: fórmula francesa con tasa 14% mensual', () => {
    // $1200 a 12 meses al 14% anual.
    // r mensual = 14/12/100 = 0.01166...
    // cuota = 1200 * 0.01166 / (1 - (1+0.01166)^-12) ≈ 107.78
    const r = evaluateEligibility({
      ...BASE,
      requestedAmountUsd: 1200,
      termMonths: 12,
      internalScore: 700,
      monthlyIncomeUsd: 1500,
      monthlyDebtUsd: 0,
      shareCapitalUsd: 100,
    });
    expect(r.eligible).toBe(true);
    const cuota = Number(r.estimatedMonthlyPayment);
    expect(cuota).toBeGreaterThan(105);
    expect(cuota).toBeLessThan(110);
  });

  it('ratio cuota/ingreso se computa y devuelve', () => {
    const r = evaluateEligibility({
      ...BASE,
      requestedAmountUsd: 1500,
      termMonths: 24,
    });
    expect(r.paymentToIncomeRatio).toBeGreaterThan(0);
    expect(r.paymentToIncomeRatio).toBeLessThan(1);
  });
});

describe('parseCalculateEligibilityInput', () => {
  it('rechaza input no-objeto', () => {
    expect(parseCalculateEligibilityInput(null)).toEqual({
      error: expect.stringMatching(/no es un objeto/),
    });
  });

  it('rechaza campos numéricos faltantes', () => {
    const r = parseCalculateEligibilityInput({
      requestedAmountUsd: 1000,
      hasActiveLoan: false,
    });
    expect(r).toHaveProperty('error');
  });

  it('rechaza termMonths fuera de rango', () => {
    const r = parseCalculateEligibilityInput({
      requestedAmountUsd: 1000,
      termMonths: 200,
      internalScore: 700,
      monthlyIncomeUsd: 1000,
      monthlyDebtUsd: 0,
      shareCapitalUsd: 100,
      hasActiveLoan: false,
    });
    expect(r).toEqual({
      error: expect.stringMatching(/termMonths/),
    });
  });

  it('rechaza hasActiveLoan no-booleano', () => {
    const r = parseCalculateEligibilityInput({
      requestedAmountUsd: 1000,
      termMonths: 12,
      internalScore: 700,
      monthlyIncomeUsd: 1000,
      monthlyDebtUsd: 0,
      shareCapitalUsd: 100,
      hasActiveLoan: 'yes',
    });
    expect(r).toEqual({
      error: expect.stringMatching(/hasActiveLoan/),
    });
  });

  it('acepta input válido', () => {
    const r = parseCalculateEligibilityInput({
      requestedAmountUsd: 1000,
      termMonths: 12,
      internalScore: 700,
      monthlyIncomeUsd: 1500,
      monthlyDebtUsd: 100,
      shareCapitalUsd: 200,
      hasActiveLoan: false,
    });
    expect(r).not.toHaveProperty('error');
  });
});
