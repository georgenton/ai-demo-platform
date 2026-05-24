# ADR-0009 — Split del LLMAdapter en ChatAdapter + EmbeddingsAdapter

- **Estado:** Aceptado
- **Fecha:** 2026-05-24
- **Decisores:** Jorge
- **Refina:** [ADR-0004](./0004-llm-adapter-pattern.md) — el patrón Adapter con selección de provider por variable de entorno sigue vigente; solo evoluciona la forma de las interfaces.

## Contexto

[`ADR-0004`](./0004-llm-adapter-pattern.md) propuso un único `LLMAdapter`
con dos métodos:

```ts
interface LLMAdapter {
  complete(...): AsyncIterable<string>;
  embed(...): Promise<number[]>;
}
```

Esa decisión se tomó **antes** de que decidiéramos los proveedores
concretos. [`ADR-0008`](./0008-openai-embeddings-for-dev.md) reveló que
**Anthropic no tiene API de embeddings**: en desarrollo, el chat lo hace
Anthropic, pero los embeddings los hace OpenAI. Son **dos proveedores
distintos en el mismo entorno**.

Forzar una interface única significaría una de dos cosas, ninguna
limpia:

- Una clase `AnthropicAdapter` que implementa `complete()` real pero
  `embed()` lanzando _"no soportado"_ — viola Liskov.
- Una clase compuesta que internamente delega a dos SDKs distintos
  según el método llamado — mezcla concerns y oculta la realidad de
  que son dos providers.

## Decisión

**Dos interfaces independientes**, expuestas como singletons separados
desde `@org/llm-adapter`:

```ts
// packages/llm-adapter/src/lib/types.ts
export interface ChatAdapter {
  completeStream(messages: ChatMessage[]): AsyncIterable<string>;
}

export interface EmbeddingsAdapter {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

```ts
// packages/llm-adapter/src/index.ts
export { chat } from './lib/chat';
export { embeddings } from './lib/embeddings';
export type { ChatAdapter, EmbeddingsAdapter, ChatMessage } from './lib/types';
```

Cada singleton se inicializa _lazy_ a partir de su propio set de env
vars (`CHAT_*` y `EMBEDDINGS_*`).

## Alternativas consideradas

### Opción A — Un único `LLMAdapter` con ambos métodos (ADR-0004 literal)

- **Pros:** una sola "puerta", continuidad con el ADR original.
- **Contras:** ningún provider real implementa ambos métodos de forma
  limpia. Forzar la unión genera código confuso (clase compuesta) o
  que viola Liskov (métodos que lanzan _"no soportado"_).

### Opción B — Umbrella `LLMAdapter` con sub-propiedades

```ts
interface LLMAdapter {
  chat: ChatAdapter;
  embeddings: EmbeddingsAdapter;
}
const llm: LLMAdapter = …;
llm.chat.completeStream(…);
llm.embeddings.embed(…);
```

- **Pros:** mantiene un objeto único llamado `LLMAdapter` (continuidad
  nominal).
- **Contras:** ceremonia extra sin valor — `llm.chat.x` no aporta nada
  sobre `chat.x`. Desde el call site, no hay realmente una sola "cosa"
  que se llame LLMAdapter; siempre es chat o embeddings.

### Opción elegida — Dos interfaces / dos singletons independientes

- **Por qué ganó:** cada interface tiene una sola responsabilidad. La
  sintaxis del call site es la más directa (`chat.x`, `embeddings.y`).
  Los providers de cada concern se eligen independientemente vía env
  vars con prefijos simétricos (`CHAT_*` / `EMBEDDINGS_*`). El switch
  a NAI sigue siendo "una variable de entorno" — en realidad dos (una
  por concern), pero apuntando al mismo cluster.

## Consecuencias

### Positivas

- **Single responsibility** por interface — código más limpio, tests
  más simples.
- **Cada provider implementa solo lo suyo.** `AnthropicChatAdapter` no
  necesita inventar un `embed()` que no existe.
- **Switch a NAI** sigue siendo trivial: cambian `CHAT_PROVIDER` y
  `EMBEDDINGS_PROVIDER` a `openai-compat` con el `*_BASE_URL` del
  cluster. La interface y el call site no cambian.
- **Testing más fácil**: mockear un singleton es más simple que
  mockear sub-propiedades.

### Negativas / costos

- ADR-0004 ya no describe literalmente la forma exacta de la interface.
  Este ADR lo aclara explícitamente.
- Sumamos un sub-archivo más (`embeddings.ts` aparte de `chat.ts`) —
  overhead mínimo.

### Riesgos / cosas a vigilar

- Si aparecen operaciones que necesitan compartir estado entre chat y
  embeddings (raro), no hay un objeto umbrella donde colgar ese estado.
  Cuando pase, se puede crear un módulo nuevo que use ambos singletons;
  no es bloqueante.

## Cuándo revisar

- Si aparece un caso donde chat y embeddings necesitan compartir
  conexión, contexto u objeto.
- Si los "concerns" del LLM crecen (ej: reranking, tool use stateful) y
  dos archivos se vuelven 8 — entonces convendría un módulo
  organizador.

## Referencias

- [`ADR-0004`](./0004-llm-adapter-pattern.md) — el patrón general
  (sigue vigente).
- [`ADR-0008`](./0008-openai-embeddings-for-dev.md) — proveedor de
  embeddings en dev (origen de la asimetría).
- `packages/llm-adapter/` (próximos commits del PR de implementación).
