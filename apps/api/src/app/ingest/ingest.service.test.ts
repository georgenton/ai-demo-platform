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

const {
  mockTxDocumentCreate,
  mockTransaction,
  mockResolveEmbeddingsProvider,
  mockEmbeddingsInfoFor,
} = vi.hoisted(() => {
  const mockTxDocumentCreate = vi.fn();
  // Imita Prisma.$transaction(callback): le pasa al callback un cliente
  // transaccional fake (`tx`) y devuelve lo que el callback devuelva.
  // Si el callback rechaza, la promise resultante rechaza también.
  const mockTransaction = vi.fn(async (callback: (tx: unknown) => unknown) => {
    const tx = { document: { create: mockTxDocumentCreate } };
    return callback(tx);
  });
  // Helpers de embeddings que el service ahora consume desde llm-adapter.
  // Defaults se reasignan en beforeEach (sub-PR 2 + ADR-0018).
  const mockResolveEmbeddingsProvider = vi.fn();
  const mockEmbeddingsInfoFor = vi.fn();
  return {
    mockTxDocumentCreate,
    mockTransaction,
    mockResolveEmbeddingsProvider,
    mockEmbeddingsInfoFor,
  };
});

vi.mock('@org/db', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

vi.mock('@org/llm-adapter', () => ({
  resolveEmbeddingsProvider: mockResolveEmbeddingsProvider,
  embeddingsInfoFor: mockEmbeddingsInfoFor,
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
    mockResolveEmbeddingsProvider.mockReset();
    mockEmbeddingsInfoFor.mockReset();

    // Default: el helper devuelve la metadata típica del setup on-prem
    // (ADR-0018). Los tests pueden override en casos específicos.
    mockEmbeddingsInfoFor.mockReturnValue({
      provider: 'private-mac',
      model: 'nomic-embed-text',
      dim: 768,
    });

    // Stubs mínimos — solo los métodos que IngestService usa.
    chunker = { split: vi.fn() } as unknown as SlidingWindowChunker;
    embeddings = { embedMany: vi.fn() } as unknown as EmbeddingService;
    vectorStore = { saveChunks: vi.fn() } as unknown as VectorStore;

    service = new IngestService(chunker, embeddings, vectorStore);
  });

  it('lanza BadRequestException si el chunker devuelve 0 chunks', async () => {
    vi.mocked(chunker.split).mockReturnValue([]);

    await expect(
      service.ingest(
        { name: 'doc.txt', content: '   ', demoId: 'rag' },
        'tenant-x',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Nunca llegamos siquiera a abrir la transacción.
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('cae al EMBEDDINGS_PROVIDER del env cuando llmProvider=anthropic', async () => {
    // Decisión renovada Q2 2026 (ver IngestService.ingest docstring):
    // Anthropic no fabrica embeddings; en lugar de rechazar, el service
    // deja que el adapter caiga al env default (típicamente openai).
    // Permite indexar PDFs con chat=Anthropic sin bloquear al user.
    mockResolveEmbeddingsProvider.mockReturnValue(null);
    vi.mocked(chunker.split).mockReturnValue([{ content: 'algo', index: 0 }]);
    vi.mocked(embeddings.embedMany).mockResolvedValue([[0.1, 0.2]]);
    // El default de mockTransaction ya provee tx.document.create con
    // mockTxDocumentCreate — solo necesitamos definir su retorno.
    mockTxDocumentCreate.mockResolvedValue({ id: 'doc-123' });
    vi.mocked(vectorStore.saveChunks).mockResolvedValue(undefined);

    await service.ingest(
      { name: 'doc.txt', content: 'algo', demoId: 'rag' },
      'tenant-x',
      'anthropic',
    );

    expect(mockResolveEmbeddingsProvider).toHaveBeenCalledWith('anthropic');
    // embedMany se llama SIN provider explícito (segundo arg undefined)
    // → cae al env default.
    expect(embeddings.embedMany).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
    );
  });

  it('corre el pipeline completo dentro de una sola transacción', async () => {
    vi.mocked(chunker.split).mockReturnValue(['chunk a', 'chunk b']);
    vi.mocked(embeddings.embedMany).mockResolvedValue([
      [1, 2],
      [3, 4],
    ]);
    mockTxDocumentCreate.mockResolvedValue({ id: 'doc-123' });
    vi.mocked(vectorStore.saveChunks).mockResolvedValue(undefined);

    const result = await service.ingest(
      {
        name: 'reglamento.pdf',
        content: 'long text here ...',
        demoId: 'rag',
      },
      'tenant-x',
    );

    expect(result).toEqual({ documentId: 'doc-123', chunkCount: 2 });

    // Una sola apertura de transacción para todo el ingest.
    expect(mockTransaction).toHaveBeenCalledOnce();

    // Cada paso recibió lo que esperábamos del anterior.
    expect(chunker.split).toHaveBeenCalledWith('long text here ...');
    // Sin llmProvider override, embedMany recibe undefined como segundo arg.
    expect(embeddings.embedMany).toHaveBeenCalledWith(
      ['chunk a', 'chunk b'],
      undefined,
    );
    // El Document.create incluye la metadata de embeddings (ADR-0018) para
    // que la búsqueda RAG sepa con qué espacio vectorial fue indexado.
    expect(mockTxDocumentCreate).toHaveBeenCalledWith({
      data: {
        name: 'reglamento.pdf',
        content: 'long text here ...',
        demoId: 'rag',
        tenantId: 'tenant-x',
        embeddingsProvider: 'private-mac',
        embeddingsModel: 'nomic-embed-text',
        embeddingsDim: 768,
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
      service.ingest(
        { name: 'x.txt', content: 'algo', demoId: 'rag' },
        'tenant-x',
      ),
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
      service.ingest(
        { name: 'x.txt', content: 'algo', demoId: 'rag' },
        'tenant-x',
      ),
    ).rejects.toBe(originalError);
  });
});
