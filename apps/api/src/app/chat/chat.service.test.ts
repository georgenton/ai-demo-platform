// -----------------------------------------------------------------------------
// Tests del ChatService.
//
// Misma estrategia que IngestService:
//   - Stubs para `embeddings`, `vectorStore`, `promptBuilder` (DI).
//   - vi.mock de @org/llm-adapter para reemplazar `chat.completeStream`
//     por un async generator que controlamos.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted permite que las refs vivan FUERA del vi.mock() para poder
// controlar los mocks por test. El mock incluye chat + helpers de
// embeddings que el service ahora usa (ver ADR-0018 + sub-PR 2).
const { mockChatStream, mockResolveEmbeddingsProvider, mockEmbeddingsInfoFor } =
  vi.hoisted(() => ({
    mockChatStream: vi.fn(),
    mockResolveEmbeddingsProvider: vi.fn(),
    mockEmbeddingsInfoFor: vi.fn(),
  }));

vi.mock('@org/llm-adapter', () => ({
  chat: {
    completeStream: mockChatStream,
  },
  resolveEmbeddingsProvider: mockResolveEmbeddingsProvider,
  embeddingsInfoFor: mockEmbeddingsInfoFor,
}));

import { ChatService } from './chat.service.js';

import type {
  EmbeddingService,
  PromptBuilder,
  VectorStore,
} from '@org/rag-core';

describe('ChatService.streamChat()', () => {
  let embeddings: EmbeddingService;
  let vectorStore: VectorStore;
  let promptBuilder: PromptBuilder;
  let service: ChatService;

  beforeEach(() => {
    mockChatStream.mockReset();
    mockResolveEmbeddingsProvider.mockReset();
    mockEmbeddingsInfoFor.mockReset();

    // Defaults: sin llmProvider override, el service lee el env. En el
    // test mockeamos el helper para que devuelva los valores típicos del
    // private-mac / nomic-embed-text de producción (ADR-0018).
    mockEmbeddingsInfoFor.mockReturnValue({
      provider: 'private-mac',
      model: 'nomic-embed-text',
      dim: 768,
    });

    embeddings = { embed: vi.fn() } as unknown as EmbeddingService;
    vectorStore = { searchTopK: vi.fn() } as unknown as VectorStore;
    promptBuilder = { build: vi.fn() } as unknown as PromptBuilder;

    service = new ChatService(embeddings, vectorStore, promptBuilder);
  });

  it('corre el pipeline completo y yieldea tokens en orden', async () => {
    vi.mocked(embeddings.embed).mockResolvedValue([0.1, 0.2]);
    vi.mocked(vectorStore.searchTopK).mockResolvedValue([
      {
        id: 'c1',
        content: 'fragmento a',
        documentId: 'd1',
        index: 0,
        distance: 0.05,
      },
      {
        id: 'c2',
        content: 'fragmento b',
        documentId: 'd1',
        index: 1,
        distance: 0.12,
      },
    ]);
    vi.mocked(promptBuilder.build).mockReturnValue([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
    mockChatStream.mockImplementation(async function* () {
      yield 'Hola';
      yield ' ';
      yield 'mundo';
    });

    const tokens: string[] = [];
    for await (const token of service.streamChat({
      q: '¿Cuál es el horario?',
      demoId: 'rag',
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hola', ' ', 'mundo']);

    // Pipeline: cada paso recibe el output del anterior.
    // Sin llmProvider override, embed recibe undefined como segundo arg.
    expect(embeddings.embed).toHaveBeenCalledWith(
      '¿Cuál es el horario?',
      undefined,
    );
    // searchTopK ahora filtra por (tenantId, demoId, embeddingsProvider,
    // embeddingsModel) — el último par viene del helper embeddingsInfoFor
    // mockeado arriba con private-mac / nomic-embed-text.
    expect(vectorStore.searchTopK).toHaveBeenCalledWith([0.1, 0.2], 5, {
      tenantId: undefined,
      demoId: 'rag',
      embeddingsProvider: 'private-mac',
      embeddingsModel: 'nomic-embed-text',
    });
    expect(promptBuilder.build).toHaveBeenCalledWith({
      question: '¿Cuál es el horario?',
      chunks: [
        { content: 'fragmento a', documentId: 'd1', index: 0 },
        { content: 'fragmento b', documentId: 'd1', index: 1 },
      ],
    });
    expect(mockChatStream).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      // El service propaga el provider del header X-LLM-Provider; sin
      // override, undefined → singleton del env (path legacy).
      { provider: undefined },
    );
  });

  it('rechaza con 400 cuando llmProvider=anthropic (no tiene embeddings)', async () => {
    // ADR-0018: Anthropic no fabrica embeddings → no podemos hacer retrieval.
    // El service debe rechazar antes de tocar la DB.
    mockResolveEmbeddingsProvider.mockReturnValue(null);

    const iter = service.streamChat(
      { q: 'algo', demoId: 'rag' },
      'tenant-x',
      'anthropic',
    );
    await expect(iter.next()).rejects.toThrow(/Anthropic/);
    expect(mockResolveEmbeddingsProvider).toHaveBeenCalledWith('anthropic');
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(vectorStore.searchTopK).not.toHaveBeenCalled();
  });

  it('usa topK del query cuando se provee', async () => {
    vi.mocked(embeddings.embed).mockResolvedValue([0.1]);
    vi.mocked(vectorStore.searchTopK).mockResolvedValue([]);
    vi.mocked(promptBuilder.build).mockReturnValue([
      { role: 'user', content: '?' },
    ]);
    mockChatStream.mockImplementation(async function* () {});

    // Consumimos todo el iterador para que el body del generator corra entero.
    const tokens: string[] = [];
    for await (const token of service.streamChat({
      q: '?',
      demoId: 'rag',
      topK: 10,
    })) {
      tokens.push(token);
    }

    // Mock empty -> no tokens. Doble check de que la iteración corrió.
    expect(tokens).toEqual([]);
    expect(vectorStore.searchTopK).toHaveBeenCalledWith(
      expect.anything(),
      10,
      expect.objectContaining({
        demoId: 'rag',
        embeddingsProvider: 'private-mac',
        embeddingsModel: 'nomic-embed-text',
      }),
    );
  });

  it('arma el prompt con chunks=[] cuando el retrieval no encuentra nada', async () => {
    // Caso real: la DB no tiene documentos del demo, o ninguno matcheó.
    // El service NO falla — pasa chunks vacíos al PromptBuilder, que arma
    // un prompt sin contexto. El LLM debería responder "no encuentro".
    vi.mocked(embeddings.embed).mockResolvedValue([0.1]);
    vi.mocked(vectorStore.searchTopK).mockResolvedValue([]);
    vi.mocked(promptBuilder.build).mockReturnValue([
      { role: 'user', content: 'pregunta sin contexto' },
    ]);
    mockChatStream.mockImplementation(async function* () {
      yield 'No encuentro esa información en el documento.';
    });

    const tokens: string[] = [];
    for await (const token of service.streamChat({
      q: 'pregunta sin contexto',
      demoId: 'rag',
    })) {
      tokens.push(token);
    }

    expect(promptBuilder.build).toHaveBeenCalledWith({
      question: 'pregunta sin contexto',
      chunks: [],
    });
    expect(tokens).toEqual(['No encuentro esa información en el documento.']);
  });
});
