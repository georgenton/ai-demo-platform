// Tests del helper puro `estimateTokens` del hook compartido.
//
// El hook completo (useEstimatedCost) no se testea con testing-library —
// no está instalado en el repo y el patrón del proyecto es testar solo
// helpers puros, no state de React.

import { describe, expect, it } from 'vitest';

import { estimateTokens } from './use-estimated-cost';

describe('estimateTokens', () => {
  it('0 chars → 0 tokens', () => {
    expect(estimateTokens(0)).toBe(0);
  });

  it('aplica la regla ~4 chars/token (industria)', () => {
    // 12 chars → 3 tokens; 80 chars → 20 tokens; 100 chars → 25 tokens.
    expect(estimateTokens(12)).toBe(3);
    expect(estimateTokens(80)).toBe(20);
    expect(estimateTokens(100)).toBe(25);
  });

  it('redondea (no trunca) — 6 chars deberían dar 2 tokens', () => {
    expect(estimateTokens(6)).toBe(2); // 6/4 = 1.5 → round = 2
    expect(estimateTokens(5)).toBe(1); // 5/4 = 1.25 → round = 1
    expect(estimateTokens(7)).toBe(2); // 7/4 = 1.75 → round = 2
  });

  it('nunca devuelve negativo (defensa contra inputs raros)', () => {
    expect(estimateTokens(-10)).toBe(0);
  });
});
