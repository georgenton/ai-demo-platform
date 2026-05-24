// -----------------------------------------------------------------------------
// Tests del IngestService.
//
// El service recibe sus dependencias del RAG (chunker, embeddings, vectorStore)
// por constructor — los pasamos como stubs con vi.fn() en cada método usado.
//
// `prisma` se importa directo de @org/db dentro del service, así que lo
// mockeamos a nivel módulo con vi.mock + vi.hoisted (mismo patrón que en
// openai-embeddings.test.ts y embedding-service.test.ts).
// -----------------------------------------------------------------------------

import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDocumentCreate, mockDocumentDelete } = vi.hoisted(() => ({
  mockDocumentCreate: vi.fn(),
  mockDocumentDelete: vi.fn(),
}));

vi.mock('@org/db', () => ({
  prisma: {
    document: {
      create: mockDocumentCreate,
      delete: mockDocumentDelete,
    },
  },
}));

import { IngestService } from './ingest.service.js';

import type {
  EmbeddingService,
  SlidingWindowChunker,
  VectorStore,
} from '@org/rag-core';

describe('IngestService', () => {
  let chunker: SlidingWindowChunker;
  let embeddings: EmbeddingService;
  let vectorStore: VectorStore;
  let service: IngestService;

  beforeEach(() => {
    mockDocumentCreate.mockReset();
    mockDocumentDelete.mockReset();

    // Stubs mínimos — solo los métodos que IngestService usa.
    chunker = { split: vi.fn() } as unknown as SlidingWindowChunker;
    embeddings = { embedMany: vi.fn() } as unknown as EmbeddingService;
    vectorStore = { saveChunks: vi.fn() } as unknown as VectorStore;

    service = new IngestService(chunker, embeddings, vectorStore);
  });

  it('lanza BadRequestException si el chunker devuelve 0 chunks', async () => {
    vi.mocked(chunker.split).mockReturnValue([]);

    await expect(
      service.ingest({ name: 'doc.txt', content: '   ', demoId: 'rag' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // No llegamos a crear el Document si el contenido no produjo chunks.
    expect(mockDocumentCreate).not.toHaveBeenCalled();
  });

  it('corre el pipeline completo en el camino feliz', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a', 'chunk b']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([
      [1, 2],
      [3, 4],
    ]);
    mockDocumentCreate.mockResolvedValue({ id: 'doc-123' });
    vi.mocked(vectorStore.saveChunks).mockResolvedValue(undefined);

    const result = await service.ingest({
      name: 'reglamento.pdf',
      content: 'long text here ...',
      demoId: 'rag',
    });

    expect(result).toEqual({ documentId: 'doc-123', chunkCount: 2 });

    // Cada paso recibe lo que esperamos del anterior.
    expect(chunker.split).toHaveBeenCalledWith('long text here ...');
    expect(embeddings.embedMany).toHaveBeenCalledWith(['chunk a', 'chunk b']);
    expect(mockDocumentCreate).toHaveBeenCalledWith({
      data: {
        name: 'reglamento.pdf',
        content: 'long text here ...',
        demoId: 'rag',
      },
    });
    expect(vectorStore.saveChunks).toHaveBeenCalledWith('doc-123', [
      { content: 'chunk a', index: 0, embedding: [1, 2] },
      { content: 'chunk b', index: 1, embedding: [3, 4] },
    ]);

    // El Document NO se borra en el camino feliz.
    expect(mockDocumentDelete).not.toHaveBeenCalled();
  });

  it('hace rollback del Document si saveChunks falla (compensating action)', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([[1, 2]]);
    mockDocumentCreate.mockResolvedValue({ id: 'doc-456' });
    vi.mocked(vectorStore.saveChunks).mockRejectedValue(
      new Error('pgvector down'),
    );
    mockDocumentDelete.mockResolvedValue({ id: 'doc-456' });

    await expect(
      service.ingest({ name: 'x.txt', content: 'algo', demoId: 'rag' }),
    ).rejects.toThrow('pgvector down');

    // El Document creado se borra para no dejar huérfanos.
    expect(mockDocumentDelete).toHaveBeenCalledWith({
      where: { id: 'doc-456' },
    });
  });

  it('propaga el error original (no lo enmascara) cuando hay rollback', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([[1, 2]]);
    mockDocumentCreate.mockResolvedValue({ id: 'doc-789' });
    const originalError = new Error('saveChunks específico');
    vi.mocked(vectorStore.saveChunks).mockRejectedValue(originalError);
    mockDocumentDelete.mockResolvedValue({ id: 'doc-789' });

    await expect(
      service.ingest({ name: 'x.txt', content: 'algo', demoId: 'rag' }),
    ).rejects.toBe(originalError);
  });
});
