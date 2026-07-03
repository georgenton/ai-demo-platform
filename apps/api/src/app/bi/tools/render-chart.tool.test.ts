// -----------------------------------------------------------------------------
// Tests del parser de render_chart. Lógica pura — sin BD, sin LLM.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { parseRenderChartInput } from './render-chart.tool.js';

describe('parseRenderChartInput', () => {
  const baseValid = {
    chartType: 'bar',
    title: 'Mora por agencia',
    recommendationReason: 'Usé barras porque compara agencias por una métrica.',
    xAxis: { key: 'nombre', label: 'Agencia' },
    yAxis: [{ key: 'pct_mora', label: 'Mora %' }],
  };

  it('acepta input válido', () => {
    const r = parseRenderChartInput(baseValid);
    expect(r).not.toHaveProperty('error');
  });

  it('rechaza input no-objeto', () => {
    expect(parseRenderChartInput(null)).toEqual({ error: expect.any(String) });
    expect(parseRenderChartInput('foo')).toEqual({ error: expect.any(String) });
  });

  it('rechaza chartType inválido', () => {
    const r = parseRenderChartInput({ ...baseValid, chartType: 'scatter' });
    expect(r).toEqual({ error: expect.stringMatching(/chartType/) });
  });

  it('rechaza title vacío o muy corto', () => {
    expect(parseRenderChartInput({ ...baseValid, title: '' })).toEqual({
      error: expect.stringMatching(/title/),
    });
    expect(parseRenderChartInput({ ...baseValid, title: 'ok' })).toEqual({
      error: expect.stringMatching(/title/),
    });
  });

  it('rechaza xAxis mal formado', () => {
    expect(
      parseRenderChartInput({ ...baseValid, xAxis: { key: 'x' } }),
    ).toEqual({
      error: expect.stringMatching(/xAxis/),
    });
  });

  it('rechaza yAxis vacío', () => {
    expect(parseRenderChartInput({ ...baseValid, yAxis: [] })).toEqual({
      error: expect.stringMatching(/yAxis/),
    });
  });

  it('rechaza pie con multi-serie', () => {
    const r = parseRenderChartInput({
      ...baseValid,
      chartType: 'pie',
      yAxis: [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
    });
    expect(r).toEqual({ error: expect.stringMatching(/una serie/) });
  });

  it('rechaza treemap con multi-serie', () => {
    const r = parseRenderChartInput({
      ...baseValid,
      chartType: 'treemap',
      yAxis: [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
    });
    expect(r).toEqual({ error: expect.stringMatching(/una serie/) });
  });

  it('acepta line con multi-serie', () => {
    const r = parseRenderChartInput({
      chartType: 'line',
      title: 'Desembolsos mensuales por producto',
      xAxis: { key: 'mes', label: 'Mes' },
      yAxis: [
        { key: 'consumo', label: 'Consumo' },
        { key: 'vivienda', label: 'Vivienda' },
      ],
    });
    expect(r).not.toHaveProperty('error');
  });

  it('preserva description opcional', () => {
    const r = parseRenderChartInput({
      ...baseValid,
      description: 'Top 5 agencias con mayor cartera vencida.',
    });
    expect(r).not.toHaveProperty('error');
    expect((r as { description: string }).description).toMatch(
      /cartera vencida/,
    );
  });

  it('genera recommendationReason por defecto si el LLM no la envía', () => {
    const { recommendationReason, ...withoutReason } = baseValid;
    expect(recommendationReason).toContain('barras');
    const r = parseRenderChartInput(withoutReason);
    expect(r).not.toHaveProperty('error');
    expect((r as { recommendationReason: string }).recommendationReason).toBe(
      'Usé barras porque la pregunta compara categorías por una métrica.',
    );
  });

  it('acepta heatmap con zAxis métrica', () => {
    const r = parseRenderChartInput({
      chartType: 'heatmap',
      title: 'Cartera por agencia y producto',
      recommendationReason:
        'Usé mapa de calor porque cruza agencias y productos.',
      xAxis: { key: 'producto', label: 'Producto' },
      yAxis: [{ key: 'agencia', label: 'Agencia' }],
      zAxis: { key: 'cartera_usd', label: 'Cartera USD' },
    });
    expect(r).not.toHaveProperty('error');
    expect((r as { zAxis: { key: string; label: string } }).zAxis).toEqual({
      key: 'cartera_usd',
      label: 'Cartera USD',
    });
  });

  it('rechaza heatmap sin zAxis', () => {
    const r = parseRenderChartInput({
      ...baseValid,
      chartType: 'heatmap',
    });
    expect(r).toEqual({ error: expect.stringMatching(/zAxis/) });
  });
});
