---
'@org/llm-adapter': minor
---

Implementa el `LLMAdapter` con dos interfaces independientes y sus
providers para dev y prod.

Interfaces (ver ADR-0009):

- `ChatAdapter.completeStream(messages)` — devuelve `AsyncIterable<string>`
  con los tokens del LLM en vivo.
- `EmbeddingsAdapter.embed(text)` y `embedMany(texts)` — convierten texto
  en vectores numéricos.

Providers:

- `AnthropicChatAdapter` — chat en dev vía `@anthropic-ai/sdk`.
- `OpenAICompatChatAdapter` — chat en prod (NAI) vía `openai` SDK con
  `baseURL` configurable.
- `OpenAIEmbeddingsAdapter` — embeddings; sirve OpenAI nativo y
  cualquier endpoint OpenAI-compat (NAI).

Uso:

```ts
import { chat, embeddings, type ChatMessage } from '@org/llm-adapter';

for await (const token of chat.completeStream([
  { role: 'user', content: 'Hola' },
])) {
  process.stdout.write(token);
}

const vector = await embeddings.embed('hola mundo');
```

Configuración por env vars con prefijos simétricos (`CHAT_*`,
`EMBEDDINGS_*`). Ver `.env.example` para el shape completo.

Incluye cobertura de Vitest (20 tests) sobre la lógica pura
(validación de env, factories) y un ejemplo de mocking del SDK de
OpenAI para los tests del adapter.
