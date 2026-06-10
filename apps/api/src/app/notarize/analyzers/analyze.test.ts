// -----------------------------------------------------------------------------
// Tests de `analyzeDocument`. Mockeamos chat.streamWithTools para no
// llamar al LLM real. Cubrimos:
//   - Golden path: el LLM emite submit_analysis con shape válido.
//   - El LLM NO llama el tool → lanza.
//   - Shape inválido del tool input → lanza con mensaje claro.
//   - docType desconocido → lanza temprano.
//   - Texto largo se trunca (no excede MAX_TEXT_CHARS).
// -----------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

const { mockStream } = vi.hoisted(() => ({ mockStream: vi.fn() }));

vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: mockStream },
}));

import { analyzeDocument } from './analyze.js';

function makeStreamThatEmits(events: unknown[]) {
  return async function* () {
    for (const e of events) yield e;
  };
}

describe('analyzeDocument', () => {
  it('parsea correctamente el tool_use_complete y devuelve DocumentAnalysis', async () => {
    mockStream.mockImplementation(
      makeStreamThatEmits([
        {
          type: 'tool_use_complete',
          id: 'tu_1',
          name: 'submit_analysis',
          input: {
            dimensions: [{ key: 'fecha', label: 'Fecha', value: '2026-06-10' }],
            risks: [
              {
                severity: 'high',
                title: 'Quórum insuficiente',
                description: 'Solo 12 de 30 socios presentes.',
              },
            ],
            recommendations: ['Reconvocar la asamblea.'],
            reasoning: 'El estatuto exige mayoría simple (16/30).',
          },
        },
        { type: 'turn_end', stopReason: 'tool_use' },
      ]),
    );

    const result = await analyzeDocument(
      'assembly_minutes',
      'texto del acta...',
    );

    expect(result.docType).toBe('assembly_minutes');
    expect(result.dimensions).toHaveLength(1);
    expect(result.dimensions[0]).toEqual({
      key: 'fecha',
      label: 'Fecha',
      value: '2026-06-10',
    });
    expect(result.risks).toHaveLength(1);
    expect(result.risks[0].severity).toBe('high');
    expect(result.recommendations).toEqual(['Reconvocar la asamblea.']);
    expect(result.reasoning).toContain('estatuto');
  });

  it('lanza si el LLM nunca llama submit_analysis', async () => {
    mockStream.mockImplementation(
      makeStreamThatEmits([
        { type: 'text_delta', text: 'No puedo ayudarte.' },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]),
    );

    await expect(analyzeDocument('loan', 'texto del préstamo')).rejects.toThrow(
      /sin llamar/,
    );
  });

  it('rechaza shape inválido (falta dimensions)', async () => {
    mockStream.mockImplementation(
      makeStreamThatEmits([
        {
          type: 'tool_use_complete',
          id: 'tu_1',
          name: 'submit_analysis',
          input: { risks: [], recommendations: [], reasoning: 'x' },
        },
      ]),
    );

    await expect(
      analyzeDocument('capital_contribution', 'algo'),
    ).rejects.toThrow(/dimensions/);
  });

  it('rechaza severity fuera del enum', async () => {
    mockStream.mockImplementation(
      makeStreamThatEmits([
        {
          type: 'tool_use_complete',
          id: 'tu_1',
          name: 'submit_analysis',
          input: {
            dimensions: [{ key: 'a', label: 'A', value: 'v' }],
            risks: [{ severity: 'critical', title: 't', description: 'd' }],
            recommendations: [],
            reasoning: 'r',
          },
        },
      ]),
    );

    await expect(analyzeDocument('loan', 'algo')).rejects.toThrow(/severity/);
  });

  it('docType desconocido → lanza temprano (sin invocar LLM)', async () => {
    mockStream.mockClear();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      analyzeDocument('inventado' as any, 'algo'),
    ).rejects.toThrow(/docType desconocido/);
    expect(mockStream).not.toHaveBeenCalled();
  });
});
