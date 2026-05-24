// Tests del PromptBuilder.
// Pura lógica de strings y armado de mensajes → muy testeable sin mocks.

import { describe, expect, it } from 'vitest';

import { DEFAULT_SYSTEM_PROMPT, PromptBuilder } from './prompt-builder.js';

describe('PromptBuilder — sin chunks recuperados', () => {
  const builder = new PromptBuilder();

  it('devuelve [system, user] con el system prompt por defecto', () => {
    const messages = builder.build({ question: '¿Hola?', chunks: [] });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: 'system',
      content: DEFAULT_SYSTEM_PROMPT,
    });
    expect(messages[1]).toEqual({ role: 'user', content: '¿Hola?' });
  });

  it('no agrega contexto cuando no hay chunks', () => {
    const messages = builder.build({ question: 'pregunta', chunks: [] });
    expect(messages[1].content).toBe('pregunta');
    expect(messages[1].content).not.toContain('Fragmento');
  });
});

describe('PromptBuilder — con chunks recuperados', () => {
  const builder = new PromptBuilder();

  it('incrusta los chunks como contexto antes de la pregunta', () => {
    const messages = builder.build({
      question: '¿Cuál es el horario de tutorías?',
      chunks: [
        {
          content: 'Las tutorías son de 8 a 17 hs.',
          documentId: 'doc-1',
          index: 5,
        },
        {
          content: 'Se atiende de lunes a viernes.',
          documentId: 'doc-1',
          index: 6,
        },
      ],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');

    const userContent = messages[1].content;

    // Cada chunk aparece, etiquetado con su documento e índice.
    expect(userContent).toContain('Fragmento 1');
    expect(userContent).toContain('doc-1');
    expect(userContent).toContain('posición 5');
    expect(userContent).toContain('Las tutorías son de 8 a 17 hs.');
    expect(userContent).toContain('Fragmento 2');
    expect(userContent).toContain('posición 6');
    expect(userContent).toContain('Se atiende de lunes a viernes.');

    // La pregunta del usuario aparece después de los fragmentos.
    expect(userContent).toContain('¿Cuál es el horario de tutorías?');
    expect(userContent.indexOf('Fragmento 1')).toBeLessThan(
      userContent.indexOf('¿Cuál es el horario'),
    );
  });
});

describe('PromptBuilder — system prompt custom', () => {
  const builder = new PromptBuilder();

  it('usa el systemPrompt provisto en lugar del default', () => {
    const messages = builder.build({
      question: 'algo',
      chunks: [],
      systemPrompt: 'Sos un experto en derecho laboral ecuatoriano.',
    });
    expect(messages[0]).toEqual({
      role: 'system',
      content: 'Sos un experto en derecho laboral ecuatoriano.',
    });
    expect(messages[0].content).not.toBe(DEFAULT_SYSTEM_PROMPT);
  });
});
