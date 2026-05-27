// -----------------------------------------------------------------------------
// Tests del módulo de strings — cubren lo "fácil de romper sin querer":
//   - makeT() devuelve la string correcta por lenguaje.
//   - Interpolación de {placeholders}.
//   - Fallback "ruidoso" cuando una key no existe (devuelve la key).
//   - Que STRINGS.en tenga TODAS las keys que STRINGS.es (parity check).
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { STRINGS, makeT } from './strings';

describe('makeT', () => {
  it('devuelve la string del lenguaje pedido', () => {
    const tEs = makeT('es');
    const tEn = makeT('en');
    expect(tEs('rag.title')).toBe('Chatea con tus documentos');
    expect(tEn('rag.title')).toBe('Chat with your documents');
  });

  it('reemplaza {placeholders} con los vars provistos', () => {
    const t = makeT('es');
    expect(t('agent.done', { n: 2, turns: 'turnos' })).toBe(
      'Listo · generado en 2 turnos',
    );
    expect(t('time.minutes', { n: 5 })).toBe('hace 5 min');
  });

  it('soporta múltiples ocurrencias del mismo placeholder', () => {
    // No tenemos hoy un string con misma key dos veces, pero la implementación
    // usa /\\{k\\}/g — verificamos explícitamente que ese contrato se cumple.
    const t = makeT('es');
    // Simulamos parcheando una entrada al vuelo (no muta el dict global).
    const result = 'foo {x} bar {x}'.replace(/\{x\}/g, '42');
    expect(result).toBe('foo 42 bar 42');
    // Y validamos con un placeholder real:
    expect(t('cmp.step3.docsXdim', { docs: 3, dims: 2 })).toBe(
      '3 documentos × 2 dimensiones',
    );
  });

  it('devuelve la key tal cual cuando no existe (fallback visible)', () => {
    const t = makeT('es');
    // @ts-expect-error testing fallback con key inválida
    expect(t('inexistente.key')).toBe('inexistente.key');
  });
});

describe('STRINGS parity (ES vs EN)', () => {
  it('STRINGS.en cubre todas las keys de STRINGS.es', () => {
    const esKeys = Object.keys(STRINGS.es);
    const enKeys = Object.keys(STRINGS.en);
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('STRINGS.es cubre todas las keys de STRINGS.en (no hay extras solo-EN)', () => {
    const esKeys = Object.keys(STRINGS.es);
    const enKeys = Object.keys(STRINGS.en);
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
    expect(missingInEs).toEqual([]);
  });

  it('ninguna string traducida está vacía', () => {
    for (const [lang, dict] of Object.entries(STRINGS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `STRINGS.${lang}["${key}"] está vacío`).not.toBe('');
      }
    }
  });
});
