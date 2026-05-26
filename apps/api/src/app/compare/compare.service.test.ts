// -----------------------------------------------------------------------------
// Tests del CompareService.
//
// El service usa:
//   - `prisma.document.findMany` (lectura)  → mock vía vi.mock('@org/db')
//   - `chat.completeStream`                  → mock vía vi.mock('@org/llm-adapter')
//   - `ComparePromptBuilder`                 → instancia real (no necesita mock,
//     es puro y ya tiene su propia suite).
//
// Cubrimos:
//   - Happy path: ambos documentos existen, prompt se arma con el contenido,
//     los tokens fluyen.
//   - 404: falta un documento → NotFoundException con el id faltante.
//   - Truncado: documento gigante se trunca antes de llegar al builder.
// -----------------------------------------------------------------------------

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany, mockCompleteStream } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCompleteStream: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: { document: { findMany: mockFindMany } },
}));

vi.mock('@org/llm-adapter', () => ({
  chat: { completeStream: mockCompleteStream },
}));

import { CompareService } from './compare.service.js';
import { ComparePromptBuilder } from './compare-prompt-builder.js';

/** Yields un array de tokens como AsyncIterable, imitando el chat.completeStream real. */
async function* stream(tokens: string[]): AsyncIterable<string> {
  for (const t of tokens) yield t;
}

/** Consume un AsyncIterable a un string concatenado — útil para asserts. */
async function collect(iter: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of iter) out += chunk;
  return out;
}

describe('CompareService.streamCompare()', () => {
  let promptBuilder: ComparePromptBuilder;
  let service: CompareService;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockCompleteStream.mockReset();
    // Usamos el builder real — es puro y simple.
    promptBuilder = new ComparePromptBuilder();
    service = new CompareService(promptBuilder);
  });

  it('happy path: trae docs, arma prompt y stremea los tokens', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'a.pdf',
        content: 'A dice X',
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'd2',
        name: 'b.pdf',
        content: 'B dice Y',
        createdAt: new Date('2026-01-02'),
      },
    ]);
    mockCompleteStream.mockReturnValue(stream(['Hola', ' ', 'mundo']));

    const result = await collect(
      service.streamCompare({
        documentIds: ['d1', 'd2'],
        dimensions: ['contenido'],
      }),
    );

    expect(result).toBe('Hola mundo');
    // El builder armó algo que incluye los IDs y la dimensión.
    const messages = mockCompleteStream.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('d1');
    expect(messages[1].content).toContain('d2');
    expect(messages[1].content).toContain('contenido');
  });

  it('lanza 404 con los IDs faltantes cuando algún documento no existe', async () => {
    // Solo aparece 'd1' — pidieron d1 y d2.
    mockFindMany.mockResolvedValue([
      { id: 'd1', name: 'a.pdf', content: 'x', createdAt: new Date() },
    ]);

    await expect(
      collect(
        service.streamCompare({
          documentIds: ['d1', 'd2'],
          dimensions: ['x'],
        }),
      ),
    ).rejects.toMatchObject({
      name: NotFoundException.name,
      message: expect.stringContaining('d2'),
    });

    // Si falta un doc, NO debe llamar al LLM (no se paga por nada).
    expect(mockCompleteStream).not.toHaveBeenCalled();
  });

  it('trunca documentos que exceden el tope antes de pasarlos al builder', async () => {
    const huge = 'x'.repeat(50_000);
    mockFindMany.mockResolvedValue([
      { id: 'd1', name: 'big.pdf', content: huge, createdAt: new Date() },
      { id: 'd2', name: 'ok.pdf', content: 'small', createdAt: new Date() },
    ]);
    mockCompleteStream.mockReturnValue(stream(['ok']));

    await collect(
      service.streamCompare({
        documentIds: ['d1', 'd2'],
        dimensions: ['x'],
      }),
    );

    const userContent = mockCompleteStream.mock.calls[0][0][1].content;
    // El doc grande aparece marcado como [TRUNCADO] y cortado.
    expect(userContent).toMatch(/Documento d1 .*\[TRUNCADO\]/);
    // El doc chico NO aparece marcado.
    expect(userContent).not.toMatch(/Documento d2 .*\[TRUNCADO\]/);
    // No metimos los 50K chars completos al prompt.
    expect(userContent.length).toBeLessThan(50_000);
  });
});
