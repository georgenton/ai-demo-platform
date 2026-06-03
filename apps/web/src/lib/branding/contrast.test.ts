// =============================================================================
// Tests de contrast.ts — guarda de contraste WCAG.
//
// Verifica los números reales calculados por Claude Design en los mockups
// (sección "Pieza 4" del handoff multi-tenant-frontend-refinement.md):
//
//   #43C194 (mint-500) → 2.11 contra fondo claro → falla 3:1
//   #2E9A72 (mint-600) → 3.28 claro / 5.58 oscuro → pasa
//   #2A6FDB (azul)     → pasa ambos
//   #FFFFAA (amarillo) → ratio absurdamente alto en oscuro pero falla claro
// =============================================================================

import { describe, expect, it } from 'vitest';

import {
  AA_NONTEXT,
  FALLBACK_ACCENT,
  SIDEBAR_BG,
  contrastRatio,
  evaluateAccent,
  hexToRgb,
  passesAA,
  resolveAccentStrict,
} from './contrast';

// ---------------------------------------------------------------------------
// hexToRgb — parsing del hex con todas sus formas
// ---------------------------------------------------------------------------

describe('hexToRgb', () => {
  it('parsea #RRGGBB sin prefijo', () => {
    expect(hexToRgb('43C194')).toEqual({ r: 0x43, g: 0xc1, b: 0x94 });
  });

  it('parsea #RRGGBB con prefijo', () => {
    expect(hexToRgb('#2e9a72')).toEqual({ r: 0x2e, g: 0x9a, b: 0x72 });
  });

  it('expande la forma corta #RGB → #RRGGBB', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('devuelve null para input inválido', () => {
    expect(hexToRgb('not a color')).toBeNull();
    expect(hexToRgb('#zzzzzz')).toBeNull();
    expect(hexToRgb('#1234')).toBeNull(); // longitud rara
    expect(hexToRgb('')).toBeNull();
  });

  it('devuelve null para non-string (defensa contra inputs corruptos)', () => {
    expect(hexToRgb(123 as unknown as string)).toBeNull();
    expect(hexToRgb(null as unknown as string)).toBeNull();
    expect(hexToRgb(undefined as unknown as string)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// contrastRatio — los números deben coincidir con WCAG real
// ---------------------------------------------------------------------------

describe('contrastRatio', () => {
  it('devuelve 21 para negro vs blanco (máximo posible)', () => {
    // Math conocida — WCAG da exactamente 21 para black/white.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('devuelve 1 para colores idénticos', () => {
    expect(contrastRatio('#43C194', '#43C194')).toBeCloseTo(1, 2);
  });

  it('coincide con los números medidos por Claude Design para #FF6600 vs #f6f7f9', () => {
    // Documentado en el handoff: #FF6600 → 2.74:1 en claro. Tolerancia 0.05.
    const ratio = contrastRatio('#FF6600', SIDEBAR_BG.light);
    expect(ratio).toBeGreaterThan(2.6);
    expect(ratio).toBeLessThan(2.9);
  });

  it('mint-500 NO pasa 3:1 contra el fondo claro (2.11:1)', () => {
    const ratio = contrastRatio('#43C194', SIDEBAR_BG.light);
    expect(ratio).toBeLessThan(AA_NONTEXT);
    expect(ratio).toBeCloseTo(2.11, 1);
  });

  it('mint-600 SÍ pasa 3:1 contra el fondo claro (3.28:1)', () => {
    const ratio = contrastRatio('#2E9A72', SIDEBAR_BG.light);
    expect(ratio).toBeGreaterThan(AA_NONTEXT);
    expect(ratio).toBeCloseTo(3.28, 1);
  });

  it('devuelve 0 si alguno de los hex no parsea', () => {
    expect(contrastRatio('not a color', '#000000')).toBe(0);
    expect(contrastRatio('#000000', 'invalid')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// passesAA — helper para chequeo binario
// ---------------------------------------------------------------------------

describe('passesAA', () => {
  it('true para colores con contraste >= 3:1', () => {
    expect(passesAA('#000000', '#ffffff')).toBe(true);
    expect(passesAA('#2E9A72', SIDEBAR_BG.light)).toBe(true);
  });

  it('false para colores con contraste < 3:1', () => {
    expect(passesAA('#43C194', SIDEBAR_BG.light)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateAccent — la política theme-aware
// ---------------------------------------------------------------------------

describe('evaluateAccent', () => {
  it('mint-600 pasa en ambos temas', () => {
    const ev = evaluateAccent('#2E9A72');
    expect(ev.ok).toBe(true);
    expect(ev.light).toBe(true);
    expect(ev.dark).toBe(true);
    expect(ev.failing).toBeNull();
  });

  it('mint-500 falla en claro, pasa en oscuro', () => {
    const ev = evaluateAccent('#43C194');
    expect(ev.ok).toBe(false);
    expect(ev.light).toBe(false);
    expect(ev.dark).toBe(true);
    expect(ev.failing).toBe('light');
  });

  it('#FFFFAA (amarillo brillante) falla en claro (caso del mockup)', () => {
    // Documentado en 04-sidebar.html: este es el caso "accent ilegible".
    const ev = evaluateAccent('#FFFFAA');
    expect(ev.ok).toBe(false);
    expect(ev.light).toBe(false);
    expect(ev.failing).toBe('light');
  });

  it('#2A6FDB (azul corporativo) pasa ambos temas', () => {
    // Documentado en 04-sidebar.html: caso "con logo del tenant".
    const ev = evaluateAccent('#2A6FDB');
    expect(ev.ok).toBe(true);
    expect(ev.light).toBe(true);
    expect(ev.dark).toBe(true);
  });

  it('#7B5BD6 (violeta) pasa ambos temas', () => {
    // Documentado en 04-sidebar.html: caso "nombre largo".
    const ev = evaluateAccent('#7B5BD6');
    expect(ev.ok).toBe(true);
  });

  it('hex inválido se trata como falla (devuelve ratios 0)', () => {
    const ev = evaluateAccent('not a hex');
    expect(ev.ok).toBe(false);
    expect(ev.light).toBe(false);
    expect(ev.dark).toBe(false);
  });

  it('acepta override de backgrounds para testing futuro', () => {
    const ev = evaluateAccent('#000000', { light: '#000000', dark: '#000000' });
    expect(ev.ok).toBe(false); // black-on-black no pasa
  });
});

// ---------------------------------------------------------------------------
// resolveAccentStrict — la función que el sidebar realmente llama
// ---------------------------------------------------------------------------

describe('resolveAccentStrict', () => {
  it('devuelve el accent del tenant cuando pasa ambos temas', () => {
    expect(resolveAccentStrict('#2A6FDB')).toBe('#2A6FDB');
    expect(resolveAccentStrict('#7B5BD6')).toBe('#7B5BD6');
  });

  it('cae al fallback mint-600 cuando el accent falla en cualquier tema', () => {
    expect(resolveAccentStrict('#43C194')).toBe(FALLBACK_ACCENT);
    expect(resolveAccentStrict('#FFFFAA')).toBe(FALLBACK_ACCENT);
  });

  it('cae al fallback cuando el accent es null/undefined/empty', () => {
    expect(resolveAccentStrict(null)).toBe(FALLBACK_ACCENT);
    expect(resolveAccentStrict(undefined)).toBe(FALLBACK_ACCENT);
    expect(resolveAccentStrict('')).toBe(FALLBACK_ACCENT);
  });

  it('cae al fallback cuando el accent no parsea', () => {
    expect(resolveAccentStrict('not a hex')).toBe(FALLBACK_ACCENT);
  });

  it('acepta override del fallback (útil para testing o A/B)', () => {
    expect(resolveAccentStrict('#43C194', '#000000')).toBe('#000000');
  });
});
