# Handoff Codex — Sub-PR 2 (Embeddings on-prem · Backend)

> **Cómo usar este documento.** Está pensado para que Codex (u otro
> agente) verifique el sub-PR 2 sin contexto previo. Léelo de arriba a
> abajo y reporta hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Segundo sub-PR de 4 del tren "Embeddings on-prem" (ADR-0018). Toca **solo
backend**: el switch dinámico de embeddings (espejo de `chatFor`), el
bloqueo de demo RAG/ingest cuando el dropdown está en Anthropic, y la
metadata de espacio vectorial en `Document`. El frontend no cambia
todavía (sub-PR 3).

### Stacked sobre sub-PR 1

Esta rama se basa en `feat/embeddings-on-prem-pr-1-schema`. Si se mergea
sub-PR 1 antes, GitHub recalcula la base automáticamente. Hasta entonces,
el diff de esta PR incluye los commits del sub-PR 1 también — al revisar
ignorar los commits del sub-PR 1 ya verificados en el handoff anterior.

### Archivos tocados (solo sub-PR 2)

| Archivo                                               | Cambio                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/llm-adapter/src/lib/embeddings.ts`          | Refactor completo a patrón `chatFor`: `embeddingsFor`, `EmbeddingsCallOptions`, `embeddingsInfoFor`, `resolveEmbeddingsProvider`. |
| `packages/llm-adapter/src/index.ts`                   | Exports nuevos.                                                                                                                   |
| `packages/rag-core/src/lib/embedding-service.ts`      | `embed(text, opts?)` y `embedMany(texts, opts?)` propagan `{ provider }`.                                                         |
| `packages/rag-core/src/lib/vector-store.ts`           | `SearchOptions` gana `embeddingsProvider`/`embeddingsModel`. `searchTopK` filtra por (provider, model) cuando se proveen.         |
| `apps/api/src/app/chat/chat.service.ts`               | Recibe `llmProvider`, resuelve embeddings provider, rechaza con 400 si es `anthropic`, propaga al embed + searchTopK.             |
| `apps/api/src/app/ingest/ingest.service.ts`           | Idem. Ademas popula `Document.embeddings{Provider,Model,Dim}` al crear cada Document.                                             |
| `apps/api/src/app/ingest/ingest.controller.ts`        | Inyecta `@CurrentLlmProvider()` en `POST /ingest` y `POST /ingest/file`.                                                          |
| `apps/api/src/app/corpus/corpus.controller.ts`        | Inyecta `@CurrentLlmProvider()` en `POST /corpus/upload`.                                                                         |
| `apps/api/src/app/corpus/corpus-ingest.service.ts`    | Recibe `llmProvider`, lo propaga a `ingestService.ingest` y al `chat.completeStream` de extracción de metadata.                   |
| `apps/api/src/app/chat/chat.service.test.ts`          | Mocks de `embeddingsInfoFor` + `resolveEmbeddingsProvider`. Test nuevo: rechazo de anthropic.                                     |
| `apps/api/src/app/ingest/ingest.service.test.ts`      | Idem. Test nuevo: rechazo de anthropic, valida que Document.create incluye los 3 campos de embeddings.                            |
| `packages/rag-core/src/lib/embedding-service.test.ts` | Firma `embedMany(texts, opts?)` reemplaza `embedMany(texts, batchSize?)`. Test nuevo: forward de `opts.provider`.                 |
| `docs/handoffs/embeddings-onprem-sub-pr-2.md`         | Este documento.                                                                                                                   |

### Lo que NO toca este sub-PR

- Schema Prisma + migración (en sub-PR 1).
- Frontend (en sub-PR 3).
- Runbook + ADR de cierre (en sub-PR 4).

## Cómo verificar el sub-PR

### Sección 1 — Compilación + cliente Prisma

```bash
cd ~/Projects_local/ai-demo-platform
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx tsc -p packages/llm-adapter/tsconfig.lib.json
npx tsc -p packages/rag-core/tsconfig.lib.json
npx tsc -p apps/api/tsconfig.app.json --noEmit
```

**Esperado:** todos limpios (sin output o "Generated Prisma Client").

### Sección 2 — Tests, lint, typecheck

```bash
npm test                # esperado: 419/419 verde (sub-PR 1 tenía 415; +4 tests nuevos)
npm run lint            # esperado: sin output
```

Los tests nuevos cubren:

- `EmbeddingService.embed` forwardea `opts.provider`.
- `EmbeddingService.embedMany` forwardea `opts.provider` en cada batch.
- `ChatService.streamChat` rechaza con `/Anthropic/` cuando llmProvider=anthropic.
- `IngestService.ingest` rechaza con `/Anthropic/` cuando llmProvider=anthropic.

### Sección 3 — Inspección de código clave

Verificar manualmente que:

1. `packages/llm-adapter/src/lib/embeddings.ts` tiene:
   - `embeddingsFor(provider)` con cache `Map<EmbeddingsProvider, EmbeddingsAdapter>` + reuso del singleton.
   - `EmbeddingsCallOptions { provider?: EmbeddingsProvider }`.
   - `resolveEmbeddingsProvider(chat: ChatProvider): EmbeddingsProvider | null` — devuelve null SOLO para `anthropic`.
   - `embeddingsInfoFor(provider): { provider, model, dim }` con `DEFAULT_DIMS = { openai: 1536, 'openai-compat': 1536, 'private-mac': 768, fake: 768 }`.

2. `apps/api/src/app/chat/chat.service.ts`:
   - Importa `embeddingsInfoFor` y `resolveEmbeddingsProvider`.
   - Si `llmProvider === 'anthropic'`, lanza `BadRequestException` ANTES de tocar embeddings.
   - Pasa `{ provider }` al `this.embeddings.embed(...)`.
   - Pasa `embeddingsProvider` + `embeddingsModel` al `vectorStore.searchTopK(...)`.

3. `apps/api/src/app/ingest/ingest.service.ts`:
   - Mismo bloqueo de anthropic.
   - `Document.create` incluye los 3 campos: `embeddingsProvider`, `embeddingsModel`, `embeddingsDim`.

### Sección 4 — Comportamiento end-to-end esperado

Con la migración del sub-PR 1 aplicada en una base local + `EMBEDDINGS_PROVIDER=fake` + `CHAT_PROVIDER=fake`:

| #   | Acción                                                                       | Esperado                                                                          |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `POST /ingest` sin header                                                    | 201; Document creado con `embeddingsProvider='fake'` (o el env), chunks indexados |
| 2   | `POST /ingest` con header `X-LLM-Provider: anthropic`                        | 400 con mensaje `/Anthropic/`                                                     |
| 3   | `POST /ingest` con header `X-LLM-Provider: private-mac` (env no configurado) | 500 con mensaje `PRIVATE_LLM_*` faltante (validación tardía del adapter)          |
| 4   | `GET /chat?q=...` sin header                                                 | SSE stream normal                                                                 |
| 5   | `GET /chat?q=...&llmProvider=anthropic`                                      | 400 con mensaje `/Anthropic/`                                                     |
| 6   | `POST /corpus/upload` con header `X-LLM-Provider: anthropic`                 | 400 (porque internamente llama `ingestService.ingest`)                            |

### Sección 5 — Smoke test del API con curl

Con el server corriendo en localhost:3000:

```bash
# 1. Login (asume seed con admin@nai.local).
curl -c /tmp/c.jar -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@nai.local","password":"demo-platform-2026"}'

# 2. Chat con Anthropic → debería rechazar.
curl -b /tmp/c.jar -i \
  "http://localhost:3000/api/v1/chat?q=hola&demoId=rag&llmProvider=anthropic"
# Esperado: HTTP 400 con mensaje en JSON sobre Anthropic.

# 3. Ingest con Anthropic → debería rechazar.
curl -b /tmp/c.jar -i -X POST http://localhost:3000/api/v1/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-LLM-Provider: anthropic' \
  -d '{"name":"test","content":"texto de prueba","demoId":"rag"}'
# Esperado: HTTP 400.

# 4. Ingest con fake (env default) → debería indexar OK.
curl -b /tmp/c.jar -i -X POST http://localhost:3000/api/v1/ingest \
  -H 'Content-Type: application/json' \
  -d '{"name":"test","content":"texto de prueba largo y con contenido relevante","demoId":"rag"}'
# Esperado: HTTP 201 con { documentId, chunkCount }.
```

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `prisma generate` salida.
- `npm test` salida (resumen).
- `npm run lint` salida.
- `tsc` salidas (api, rag-core, llm-adapter).

### Sección B — Inspección del adapter

- `packages/llm-adapter/src/lib/embeddings.ts` tiene `embeddingsFor`,
  `embeddingsInfoFor`, `resolveEmbeddingsProvider`, `isValidEmbeddingsProvider`.
- El export desde `index.ts` los incluye.

### Sección C — Inspección de los services

- ChatService.streamChat acepta `llmProvider?: ChatProvider`.
- IngestService.ingest acepta `llmProvider?: ChatProvider`.
- Ambos llaman `resolveEmbeddingsProvider` y rechazan si devuelve null.
- IngestService.ingest popula los 3 campos nuevos en `Document.create`.

### Sección D — Inspección de los controllers

- `IngestController` (ambos handlers) y `CorpusController` (upload)
  inyectan `@CurrentLlmProvider()` y lo propagan al service.

### Sección E — Tests verdes

- 419/419 con tests nuevos para el rechazo de anthropic.

### Sección F — Riesgos detectados (si hay alguno)

Cualquier cosa que el reporte automatizado no cuente pero que se note
manualmente al leer el código.

---

**Nota para Jorge:** este sub-PR depende del sub-PR 1 mergeado. Si todavía
no se mergeó #93, GitHub lo va a marcar como "based on PR #93" y mostrará
el diff combinado. Cuando #93 se mergee, el de este PR queda solo.
