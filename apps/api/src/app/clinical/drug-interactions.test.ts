// -----------------------------------------------------------------------------
// Tests del vademécum mock.
//
// La función que importa es `checkDrugInteractions(meds)`. Cubrimos:
//   - Normalización: saca dosis/frecuencias, mantiene el principio activo.
//   - Match positivo: el par real del seed (warfarina + ibuprofeno).
//   - Sin match: drogas sin interacción conocida.
//   - Una sola droga: nunca matchea (no hay self-interaction).
//   - Bidireccional: (A, B) y (B, A) dan el mismo resultado.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  checkDrugInteractions,
  normalizeMedication,
} from './drug-interactions.js';

describe('normalizeMedication', () => {
  it('quita dosis numéricas y unidades', () => {
    expect(normalizeMedication('metformina 850mg BID')).toBe('metformina');
  });

  it('quita frecuencias comunes', () => {
    expect(normalizeMedication('enalapril 10mg QD')).toBe('enalapril');
    expect(normalizeMedication('paracetamol 500mg PRN')).toBe('paracetamol');
  });

  it('preserva el principio activo cuando viene con vía y horario', () => {
    expect(normalizeMedication('insulina NPH 20U AM / 12U PM')).toContain(
      'insulina nph',
    );
  });

  it('es case-insensitive', () => {
    expect(normalizeMedication('WARFARINA 5MG QD')).toBe('warfarina');
  });
});

describe('checkDrugInteractions', () => {
  it('detecta una interacción grave conocida', () => {
    const result = checkDrugInteractions([
      'warfarina 5mg QD',
      'ibuprofeno 400mg PRN',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('grave');
    expect(result[0].drugA).toBe('warfarina');
    expect(result[0].drugB).toBe('ibuprofeno');
  });

  it('devuelve lista vacía cuando no hay interacción conocida', () => {
    const result = checkDrugInteractions([
      'levotiroxina 75mcg QD',
      'loratadina 10mg QD',
    ]);
    expect(result).toEqual([]);
  });

  it('no matchea nunca con una sola droga', () => {
    expect(checkDrugInteractions(['warfarina 5mg QD'])).toEqual([]);
  });

  it('es bidireccional en el orden de entrada', () => {
    const a = checkDrugInteractions(['warfarina 5mg', 'aas 100mg']);
    const b = checkDrugInteractions(['aas 100mg', 'warfarina 5mg']);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  it('detecta interacciones múltiples del paciente con polifarmacia', () => {
    // Manuel Antonio Yánez del seed: enalapril + furosemida + espironolactona + digoxina
    const result = checkDrugInteractions([
      'enalapril 20mg BID',
      'furosemida 40mg QD',
      'espironolactona 25mg QD',
      'digoxina 0.25mg QD',
    ]);
    // Esperamos al menos: enalapril+espironolactona (moderada) +
    // digoxina+furosemida (moderada).
    expect(result.length).toBeGreaterThanOrEqual(2);
    const pairs = result.map((r) => `${r.drugA}+${r.drugB}`).sort();
    expect(pairs).toContain('enalapril+espironolactona');
    expect(pairs).toContain('digoxina+furosemida');
  });
});
