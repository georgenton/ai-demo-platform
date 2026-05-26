// Tests del ComparePromptBuilder.
//
// Es puro: no toca DB ni LLM. Verificamos:
//   - El shape de los mensajes (system + user).
//   - Que el user message liste documentos + dimensiones de forma
//     reconocible (cosa que el LLM pueda parsear sin ambigüedad).
//   - Que la marca [TRUNCADO] aparezca cuando el doc viene cortado.

import { describe, expect, it } from 'vitest';

import {
  ComparePromptBuilder,
  DEFAULT_COMPARE_SYSTEM_PROMPT,
  type CompareDocument,
} from './compare-prompt-builder.js';

function makeDoc(overrides: Partial<CompareDocument> = {}): CompareDocument {
  return {
    id: 'doc-1',
    name: 'contrato.pdf',
    content: 'cláusula uno: el proveedor entrega en 30 días.',
    truncated: false,
    ...overrides,
  };
}

describe('ComparePromptBuilder', () => {
  const builder = new ComparePromptBuilder();

  it('devuelve [system, user] con el system prompt por defecto', () => {
    const messages = builder.build({
      documents: [makeDoc()],
      dimensions: ['plazo de entrega'],
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: 'system',
      content: DEFAULT_COMPARE_SYSTEM_PROMPT,
    });
    expect(messages[1].role).toBe('user');
  });

  it('respeta el systemPrompt custom cuando se provee', () => {
    const messages = builder.build({
      documents: [makeDoc()],
      dimensions: ['x'],
      systemPrompt: 'CUSTOM',
    });
    expect(messages[0].content).toBe('CUSTOM');
  });

  it('el user message lista cada documento con su id y nombre', () => {
    const messages = builder.build({
      documents: [
        makeDoc({ id: 'doc-A', name: 'contratoA.pdf' }),
        makeDoc({ id: 'doc-B', name: 'contratoB.pdf' }),
      ],
      dimensions: ['plazo'],
    });
    const user = messages[1].content;
    expect(user).toContain('doc-A');
    expect(user).toContain('contratoA.pdf');
    expect(user).toContain('doc-B');
    expect(user).toContain('contratoB.pdf');
  });

  it('numera las dimensiones para que el LLM las trate en orden', () => {
    const messages = builder.build({
      documents: [makeDoc()],
      dimensions: ['plazo', 'penalización', 'precio'],
    });
    const user = messages[1].content;
    expect(user).toContain('1. plazo');
    expect(user).toContain('2. penalización');
    expect(user).toContain('3. precio');
  });

  it('marca [TRUNCADO] solo en documentos truncados', () => {
    const messages = builder.build({
      documents: [
        makeDoc({ id: 'short', truncated: false }),
        makeDoc({ id: 'long', truncated: true }),
      ],
      dimensions: ['x'],
    });
    const user = messages[1].content;
    expect(user).toMatch(/Documento long .*\[TRUNCADO\]/);
    expect(user).not.toMatch(/Documento short .*\[TRUNCADO\]/);
  });
});
