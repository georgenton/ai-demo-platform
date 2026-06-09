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

  it('delega 1:1 al adapter (sin opts → forward undefined)', async () => {
    mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
    const service = new EmbeddingService();
    const result = await service.embed('hola');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    // El wrapper siempre llama al adapter con el segundo arg — undefined si
    // el caller no pasó opts. Ver embedding-service.ts.
    expect(mockEmbed).toHaveBeenCalledWith('hola', undefined);
  });

  it('forwardea opts.provider al adapter cuando viene del caller', async () => {
    mockEmbed.mockResolvedValue([0.5]);
    const service = new EmbeddingService();
    await service.embed('hola', { provider: 'private-mac' });
    expect(mockEmbed).toHaveBeenCalledWith('hola', { provider: 'private-mac' });
  });
});

describe('EmbeddingService.embedMany()', () => {
  beforeEach(() => {
    mockEmbed.mockReset();
    mockEmbedMany.mockReset();
  });

  it('lanza si batchSize <= 0', async () => {
    const service = new EmbeddingService();
    await expect(service.embedMany(['x'], { batchSize: 0 })).rejects.toThrow(
      /batchSize/,
    );
    await expect(service.embedMany(['x'], { batchSize: -1 })).rejects.toThrow(
      /batchSize/,
    );
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
    const result = await service.embedMany(['a', 'b', 'c'], { batchSize: 10 });
    expect(result).toEqual([[1], [2], [3]]);
    expect(mockEmbedMany).toHaveBeenCalledTimes(1);
    // Sin provider override en los opts, el adapter recibe undefined como
    // segundo arg (path legacy del singleton del env).
    expect(mockEmbedMany).toHaveBeenCalledWith(['a', 'b', 'c'], undefined);
  });

  it('parte los inputs en lotes de batchSize', async () => {
    mockEmbedMany
      .mockResolvedValueOnce([[1], [2]])
      .mockResolvedValueOnce([[3], [4]])
      .mockResolvedValueOnce([[5]]);
    const service = new EmbeddingService();
    const result = await service.embedMany(['a', 'b', 'c', 'd', 'e'], {
      batchSize: 2,
    });

    expect(result).toEqual([[1], [2], [3], [4], [5]]);
    expect(mockEmbedMany).toHaveBeenCalledTimes(3);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(1, ['a', 'b'], undefined);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(2, ['c', 'd'], undefined);
    expect(mockEmbedMany).toHaveBeenNthCalledWith(3, ['e'], undefined);
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
    const result = await service.embedMany(['a', 'b', 'c', 'd'], {
      batchSize: 2,
    });
    expect(result).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
  });

  it('forwardea opts.provider al adapter en cada batch', async () => {
    mockEmbedMany.mockResolvedValue([[1], [2]]);
    const service = new EmbeddingService();
    await service.embedMany(['a', 'b'], {
      provider: 'private-mac',
      batchSize: 10,
    });
    expect(mockEmbedMany).toHaveBeenCalledWith(['a', 'b'], {
      provider: 'private-mac',
    });
  });
});
