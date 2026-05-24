// -----------------------------------------------------------------------------
// Tests del EmbeddingService — mockeamos `embeddings` de @org/llm-adapter
// para verificar el batching sin hacer llamadas reales a OpenAI/NAI.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// 1) Creamos los mocks fuera del vi.mock() para poder controlarlos por test.
const { mockEmbed, mockEmbedMany } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
  mockEmbedMany: vi.fn(),
}));

// 2) Reemplazamos el módulo @org/llm-adapter por uno fake.
vi.mock('@org/llm-adapter', () => ({
  embeddings: { embed: mockEmbed, embedMany: mockEmbedMany },
}));

// 3) Importamos DESPUÉS del mock.
import { EmbeddingService } from './embedding-service.js';

describe('EmbeddingService.embed()', () => {
  beforeEach(() => {
    mockEmbed.mockReset();
    mockEmbedMany.mockReset();
  });

  it('delega 1:1 al adapter', async () => {
    mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
    const service = new EmbeddingService();
    const result = await service.embed('hola');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbed).toHaveBeenCalledWith('hola');
  });
});

describe('EmbeddingService.embedMany()', () => {
  beforeEach(() => {
    mockEmbed.mockReset();
    mockEmbedMany.mockReset();
  });

  it('lanza si batchSize <= 0', async () => {
    const service = new EmbeddingService();
    await expect(service.embedMany(['x'], 0)).rejects.toThrow(/batchSize/);
    await expect(service.embedMany(['x'], -1)).rejects.toThrow(/batchSize/);
  });

  it('devuelve [] sin llamar al adapter cuando el input está vacío', async () => {
    const service = new EmbeddingService();
    const result = await service.embedMany([]);
    expect(result).toEqual([]);
    expect(mockEmbedMany).not.toHaveBeenCalled();
  });

  it('hace UNA SOLA llamada cuando todo cabe en un batch', async () => {
    mockEmbedMany.mockResolvedValue([[1], [2], [3]]);
    const service = new EmbeddingService();
    const result = await service.embedMany(['a', 'b', 'c'], 10);
    expect(result).toEqual([[1], [2], [3]]);
    expect(mockEmbedMany).toHaveBeenCalledTimes(1);
    expect(mockEmbedMany).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('parte los inputs en lotes de batchSize', async () => {
    mockEmbedMany
      .mockResolvedValueOnce([[1], [2]])
      .mockResolvedValueOnce([[3], [4]])
      .mockResolvedValueOnce([[5]]);
    const service = new EmbeddingService();
    const result = await service.embedMany(['a', 'b', 'c', 'd', 'e'], 2);

    expect(result).toEqual([[1], [2], [3], [4], [5]]);
    expect(mockEmbedMany).toHaveBeenCalledTimes(3);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(2, ['c', 'd']);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(3, ['e']);
  });

  it('preserva el orden del output entre lotes', async () => {
    // Si esto falla, el RAG se rompe — el chunk N en la DB no correspondería
    // al embedding N, y la búsqueda devolvería texto al azar.
    mockEmbedMany
      .mockResolvedValueOnce([
        [1, 1],
        [2, 2],
      ])
      .mockResolvedValueOnce([
        [3, 3],
        [4, 4],
      ]);
    const service = new EmbeddingService();
    const result = await service.embedMany(['a', 'b', 'c', 'd'], 2);
    expect(result).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
  });
});
