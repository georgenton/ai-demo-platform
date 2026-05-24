// -----------------------------------------------------------------------------
// Tests de OpenAIEmbeddingsAdapter con el SDK 'openai' mockeado.
//
// Esto sirve también como EJEMPLO PEDAGÓGICO del patrón de mocking en Vitest:
//   - vi.hoisted() crea valores que existen antes de vi.mock() (que se hoistea).
//   - vi.mock('openai', () => …) reemplaza el módulo completo durante el test.
//   - El mock devuelve un fake con la misma forma que el SDK real, así nuestro
//     adapter no se entera que está hablando con un mock.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// 1) Creamos el mock function FUERA del vi.mock() porque queremos cambiar su
//    respuesta en cada test. vi.hoisted() lo eleva al top junto con vi.mock().
const { mockEmbedCreate } = vi.hoisted(() => ({
  mockEmbedCreate: vi.fn(),
}));

// 2) Reemplazamos el módulo 'openai' por una clase fake. Usar `class` (y no
//    una arrow function) garantiza que `new OpenAI(...)` funcione como
//    constructor. Cada instancia expone .embeddings.create apuntando a nuestro
//    mock — así el adapter no se entera que está hablando con un fake.
vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = { create: mockEmbedCreate };
  },
}));

// 3) Importamos el adapter DESPUÉS del mock (vi.mock se hoistea igual,
//    pero conviene leer el archivo en orden lógico).
import { OpenAIEmbeddingsAdapter } from './openai-embeddings.js';

describe('OpenAIEmbeddingsAdapter (SDK mockeado)', () => {
  beforeEach(() => {
    // Limpiamos el historial y las implementaciones entre tests para que
    // cada test sea independiente.
    mockEmbedCreate.mockReset();
  });

  it('embed() devuelve el vector que el SDK devuelve', async () => {
    mockEmbedCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const adapter = new OpenAIEmbeddingsAdapter({
      provider: 'openai',
      apiKey: 'sk-fake',
      model: 'text-embedding-3-small',
    });
    const vector = await adapter.embed('hola mundo');

    expect(vector).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedCreate).toHaveBeenCalledOnce();
    expect(mockEmbedCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'hola mundo',
    });
  });

  it('embedMany() devuelve un array de vectores y hace UN SOLO call (batch)', async () => {
    mockEmbedCreate.mockResolvedValue({
      data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5, 6] }],
    });

    const adapter = new OpenAIEmbeddingsAdapter({
      provider: 'openai',
      apiKey: 'sk-fake',
      model: 'text-embedding-3-small',
    });
    const vectors = await adapter.embedMany(['hola', 'mundo']);

    expect(vectors).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    // La eficiencia del batch es parte del contrato: si esto se rompiera, una
    // ingesta de 1000 chunks haría 1000 HTTP calls en vez de 1.
    expect(mockEmbedCreate).toHaveBeenCalledOnce();
    expect(mockEmbedCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['hola', 'mundo'],
    });
  });
});
