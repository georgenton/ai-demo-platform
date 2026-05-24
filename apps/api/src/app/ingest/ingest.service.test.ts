// -----------------------------------------------------------------------------
// Tests del IngestService.
//
// El service recibe sus dependencias del RAG (chunker, embeddings, vectorStore)
// por constructor — los pasamos como stubs con vi.fn() en cada método usado.
//
// `prisma` se importa directo de @org/db dentro del service y ahora se usa
// vía `prisma.$transaction(callback)`. Mockeamos `$transaction` para que
// invoque el callback con un fake `tx` que expone `document.create`. Así
// los tests cubren la verdadera mecánica de la transacción interactiva sin
// necesitar la DB.
// -----------------------------------------------------------------------------

import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTxDocumentCreate, mockTransaction } = vi.hoisted(() => {
  const mockTxDocumentCreate = vi.fn();
  // Imita Prisma.$transaction(callback): le pasa al callback un cliente
  // transaccional fake (`tx`) y devuelve lo que el callback devuelva.
  // Si el callback rechaza, la promise resultante rechaza también.
  const mockTransaction = vi.fn(async (callback: (tx: unknown) => unknown) => {
    const tx = { document: { create: mockTxDocumentCreate } };
    return callback(tx);
  });
  return { mockTxDocumentCreate, mockTransaction };
});

vi.mock('@org/db', () => ({
  prisma: {
    $transaction: mockTransaction,
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
    mockTransaction.mockClear();
    mockTxDocumentCreate.mockReset();

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

    // Nunca llegamos siquiera a abrir la transacción.
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('corre el pipeline completo dentro de una sola transacción', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a', 'chunk b']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([
      [1, 2],
      [3, 4],
    ]);
    mockTxDocumentCreate.mockResolvedValue({ id: 'doc-123' });
    vi.mocked(vectorStore.saveChunks).mockResolvedValue(undefined);

    const result = await service.ingest({
      name: 'reglamento.pdf',
      content: 'long text here ...',
      demoId: 'rag',
    });

    expect(result).toEqual({ documentId: 'doc-123', chunkCount: 2 });

    // Una sola apertura de transacción para todo el ingest.
    expect(mockTransaction).toHaveBeenCalledOnce();

    // Cada paso recibió lo que esperábamos del anterior.
    expect(chunker.split).toHaveBeenCalledWith('long text here ...');
    expect(embeddings.embedMany).toHaveBeenCalledWith(['chunk a', 'chunk b']);
    expect(mockTxDocumentCreate).toHaveBeenCalledWith({
      data: {
        name: 'reglamento.pdf',
        content: 'long text here ...',
        demoId: 'rag',
      },
    });

    // saveChunks recibió el `tx` (3er argumento) — confirma que los INSERTs
    // de chunks viajan dentro de la misma transacción que el Document.
    expect(vectorStore.saveChunks).toHaveBeenCalledWith(
      'doc-123',
      [
        { content: 'chunk a', index: 0, embedding: [1, 2] },
        { content: 'chunk b', index: 1, embedding: [3, 4] },
      ],
      expect.objectContaining({ document: expect.anything() }),
    );
  });

  it('propaga el error si saveChunks falla (Prisma se encarga del rollback)', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([[1, 2]]);
    mockTxDocumentCreate.mockResolvedValue({ id: 'doc-456' });
    vi.mocked(vectorStore.saveChunks).mockRejectedValue(
      new Error('pgvector down'),
    );

    await expect(
      service.ingest({ name: 'x.txt', content: 'algo', demoId: 'rag' }),
    ).rejects.toThrow('pgvector down');

    // Ya no hay un .delete() compensatorio manual — Prisma rollbackea la
    // transacción cuando el callback rechaza, y el Document nunca queda
    // visible. Acá solo confirmamos que el error se propaga sin maquillaje.
  });

  it('propaga el error original (no lo enmascara)', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([[1, 2]]);
    mockTxDocumentCreate.mockResolvedValue({ id: 'doc-789' });
    const originalError = new Error('saveChunks específico');
    vi.mocked(vectorStore.saveChunks).mockRejectedValue(originalError);

    await expect(
      service.ingest({ name: 'x.txt', content: 'algo', demoId: 'rag' }),
    ).rejects.toBe(originalError);
  });
});
