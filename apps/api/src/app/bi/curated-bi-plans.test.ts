import { describe, expect, it } from 'vitest';

import {
  getCuratedBiPlan,
  summarizeCuratedBiResult,
} from './curated-bi-plans.js';

describe('getCuratedBiPlan', () => {
  it('usa mora porcentual por agencia sin diasAtraso ni SUM(diasMora)', () => {
    const plan = getCuratedBiPlan('¿Qué agencia tiene más mora?');

    expect(plan?.id).toBe('mora-por-agencia');
    expect(plan?.sql).toContain("p.estado IN ('vencido','castigado')");
    expect(plan?.sql).toContain('AS pct_mora');
    expect(plan?.sql).toContain('ORDER BY pct_mora DESC');
    expect(plan?.sql).not.toContain('diasAtraso');
    expect(plan?.sql).not.toMatch(/SUM\([^)]*diasMora/i);
    expect(plan?.chartSpec.chartType).toBe('bar');
  });

  it('elige pie para distribución de cartera vigente por producto', () => {
    const plan = getCuratedBiPlan(
      '¿Cómo se distribuye la cartera vigente por tipo de producto?',
    );

    expect(plan?.id).toBe('cartera-vigente-por-producto');
    expect(plan?.chartSpec.chartType).toBe('pie');
    expect(plan?.chartSpec.xAxis.key).toBe('producto');
    expect(plan?.chartSpec.yAxis[0]?.key).toBe('cartera_usd');
  });

  it('elige heatmap para cartera por agencia y producto', () => {
    const plan = getCuratedBiPlan(
      'Muéstrame la cartera por agencia y producto',
    );

    expect(plan?.id).toBe('cartera-agencia-producto');
    expect(plan?.chartSpec.chartType).toBe('heatmap');
    expect(plan?.chartSpec.zAxis?.key).toBe('cartera_usd');
  });
});

describe('summarizeCuratedBiResult', () => {
  it('resume el primer ranking de mora por agencia', () => {
    const plan = getCuratedBiPlan('agencia con más morosidad');
    expect(plan).not.toBeNull();

    const summary = summarizeCuratedBiResult(
      plan!,
      ['nombre', 'pct_mora', 'prestamos_morosos', 'total_prestamos'],
      [['Portoviejo', '17.2', '28', '163']],
    );

    expect(summary).toContain('Portoviejo');
    expect(summary).toContain('17,2%');
    expect(summary).toContain('28');
  });
});
