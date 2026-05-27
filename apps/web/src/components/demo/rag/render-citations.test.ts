// Tests del helper renderCitations.

import { describe, expect, it } from 'vitest';

import { renderCitations } from './render-citations';

describe('renderCitations', () => {
  it('texto plano sin citas → un solo token text', () => {
    expect(renderCitations('hola mundo')).toEqual([
      { kind: 'text', text: 'hola mundo' },
    ]);
  });

  it('marca [[...]] como citation con el contenido entre corchetes', () => {
    const tokens = renderCitations(
      'El horario está en [[Reglamento, art. 14]] del año.',
    );
    expect(tokens).toEqual([
      { kind: 'text', text: 'El horario está en ' },
      { kind: 'citation', text: 'Reglamento, art. 14' },
      { kind: 'text', text: ' del año.' },
    ]);
  });

  it('múltiples citas en la misma línea preservan el orden', () => {
    const tokens = renderCitations(
      'Ver [[art. 14]] y también [[Manual, sección 3.2]].',
    );
    const citations = tokens
      .filter((t) => t.kind === 'citation')
      .map((t) => 'text' in t && t.text);
    expect(citations).toEqual(['art. 14', 'Manual, sección 3.2']);
  });

  it('convierte cada \\n en un token break', () => {
    const tokens = renderCitations('linea1\nlinea2\nlinea3');
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toEqual(['text', 'break', 'text', 'break', 'text']);
  });

  it('citation interrumpida por newline no rompe — citation queda atrás del newline', () => {
    // [[foo]] vive en la primera línea, después newline, después texto plano.
    const tokens = renderCitations('Hay [[foo]]\ny más texto');
    expect(tokens).toEqual([
      { kind: 'text', text: 'Hay ' },
      { kind: 'citation', text: 'foo' },
      { kind: 'break' },
      { kind: 'text', text: 'y más texto' },
    ]);
  });

  it('input vacío → array vacío', () => {
    expect(renderCitations('')).toEqual([]);
  });

  it('línea solo con cita → un solo token citation', () => {
    expect(renderCitations('[[única]]')).toEqual([
      { kind: 'citation', text: 'única' },
    ]);
  });

  it('llamadas múltiples al helper no comparten estado de regex (lastIndex)', () => {
    // El regex está declarado a nivel módulo con flag /g — si la función
    // olvida resetear lastIndex, la segunda llamada falla.
    const sample = 'a [[uno]] b [[dos]] c';
    const first = renderCitations(sample);
    const second = renderCitations(sample);
    expect(first).toEqual(second);
    expect(first.filter((t) => t.kind === 'citation')).toHaveLength(2);
  });
});
