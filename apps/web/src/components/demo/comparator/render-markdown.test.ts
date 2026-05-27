// Tests del renderMarkdown del Comparator.

import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './render-markdown';

describe('renderMarkdown', () => {
  it('línea vacía → blank token', () => {
    expect(renderMarkdown('')).toEqual([{ kind: 'blank' }]);
  });

  it('reconoce ## y ### como heading h2 y h3', () => {
    const out = renderMarkdown('## Resumen\n### Plazo');
    expect(out).toEqual([
      { kind: 'h2', inline: [{ kind: 'text', text: 'Resumen' }] },
      { kind: 'h3', inline: [{ kind: 'text', text: 'Plazo' }] },
    ]);
  });

  it('una línea con "- " es list-item', () => {
    const out = renderMarkdown('- contrato A');
    expect(out).toEqual([
      { kind: 'list-item', inline: [{ kind: 'text', text: 'contrato A' }] },
    ]);
  });

  it('parsea **bold** inline', () => {
    const out = renderMarkdown('El **contrato A** tiene plazo de 90 días.');
    expect(out).toEqual([
      {
        kind: 'paragraph',
        inline: [
          { kind: 'text', text: 'El ' },
          { kind: 'bold', text: 'contrato A' },
          { kind: 'text', text: ' tiene plazo de 90 días.' },
        ],
      },
    ]);
  });

  it('parsea [[citation]] inline', () => {
    const out = renderMarkdown('Ver [[cláusula 3.2]] para detalles.');
    expect(out).toEqual([
      {
        kind: 'paragraph',
        inline: [
          { kind: 'text', text: 'Ver ' },
          { kind: 'citation', text: 'cláusula 3.2' },
          { kind: 'text', text: ' para detalles.' },
        ],
      },
    ]);
  });

  it('múltiples patterns inline en la misma línea', () => {
    const out = renderMarkdown('**A** vs [[ref]] vs **B**');
    expect(out[0]).toMatchObject({ kind: 'paragraph' });
    const inline = (out[0] as { inline: unknown[] }).inline;
    expect(inline).toEqual([
      { kind: 'bold', text: 'A' },
      { kind: 'text', text: ' vs ' },
      { kind: 'citation', text: 'ref' },
      { kind: 'text', text: ' vs ' },
      { kind: 'bold', text: 'B' },
    ]);
  });

  it('documento completo con mezcla de elementos', () => {
    const md =
      '## Resumen\n\n### Plazo\n\n- **Contrato A** — 90 días [[cláusula 3.2]]\n- **Contrato B** — 60 días [[cláusula 4.1]]';
    const out = renderMarkdown(md);
    expect(out.map((t) => t.kind)).toEqual([
      'h2',
      'blank',
      'h3',
      'blank',
      'list-item',
      'list-item',
    ]);
  });

  it('llamadas múltiples no comparten estado de regex', () => {
    const sample = 'a **b** c **d**';
    expect(renderMarkdown(sample)).toEqual(renderMarkdown(sample));
  });
});
