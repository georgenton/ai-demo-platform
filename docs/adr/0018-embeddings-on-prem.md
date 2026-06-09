# ADR-0018 — Embeddings 100% on-prem (nomic-embed-text vía NAI)

- **Estado:** Aceptado
- **Fecha:** 2026-06-08
- **Decisores:** Jorge
- **Supera a:** [`ADR-0008`](./0008-openai-embeddings-for-dev.md)

## Contexto

[`ADR-0008`](./0008-openai-embeddings-for-dev.md) fijó OpenAI
`text-embedding-3-small` (1536 dim) como proveedor único de embeddings. Esa
decisión tenía sentido cuando el proyecto era solo dev y necesitaba
**simetría dev↔prod** y baja fricción para nuevos contribuidores.

Tres cambios desde entonces hicieron que esa decisión quede obsoleta:

1. **El hardware NAI on-prem está disponible en el corto plazo** (Mac de
   Jorge + túnel Cloudflare al gateway FastAPI que orquesta Ollama). El
   modelo `nomic-embed-text` (768 dim) ya está corriendo y sirviendo
   embeddings vía la API OpenAI-compatible expuesta por el gateway.
2. **El PR #90 introdujo el provider `private-mac`** tanto para chat como
   para embeddings, pero el switch a `EMBEDDINGS_PROVIDER=private-mac` en
   Railway dejó la base en un estado inconsistente: la columna era
   `vector(1536)` (de OpenAI) y los nuevos ingests con nomic-embed-text
   serían `vector(768)` → mismatch en runtime. Los 660 chunks viejos
   quedaron huérfanos porque tampoco había `OPENAI_API_KEY` configurada
   para consultarlos.
3. **El mensaje comercial del proyecto es Nutanix Enterprise AI on-prem.**
   Tener el RAG corriendo sobre el hardware del cliente ES la demo del
   producto. Depender de un servicio cloud externo (OpenAI) para los
   embeddings se contradice con el pitch.

## Decisión

**Embeddings 100% on-prem servidos por NAI.** Concretamente:

- **Modelo:** `nomic-embed-text` (768 dimensiones).
- **Proveedor único soportado para indexación:** `private-mac` (el gateway
  FastAPI del Mac de Jorge en desarrollo; el cluster Nutanix del cliente
  en producción real). Conexión vía API OpenAI-compatible
  (`/v1/embeddings`) sobre `PRIVATE_LLM_BASE_URL`.
- **Schema:** `Chunk.embedding` migra de `vector(1536)` a `vector(768)`.
  Los 660 chunks existentes y los 11 documents huérfanos se borran (data
  de prueba, confirmado por el dueño del repo el 2026-06-08).
- **Document gana metadata de embeddings:** `embeddingsProvider`,
  `embeddingsModel`, `embeddingsDim` — registramos con qué proveedor /
  modelo / dim fue indexado cada doc, para futuro proofing y para que la
  UI sepa qué modelos siguen siendo compatibles.
- **Anthropic queda solo como proveedor de chat.** El demo RAG queda
  bloqueado si el dropdown del header está en `anthropic` (Anthropic no
  fabrica embeddings y no queremos sumar un tercer proveedor cloud). Los
  otros 6 demos (HR, tutor, comparator, agent, clinical, corpus chat)
  siguen funcionando con cualquier proveedor del dropdown porque no usan
  embeddings.

Esta decisión NO bloquea agregar otros proveedores de embeddings en el
futuro (Voyage AI, OpenAI vía marketplace, etc). Si llega esa necesidad,
se evalúa schema multi-columna o tabla `ChunkEmbedding` separada — ver
"Alternativas consideradas".

## Alternativas consideradas

### Opción A — Mantener OpenAI + sumar Anthropic-Voyage en paralelo

Schema multi-columna: `embeddingOpenai vector(1536)` + `embeddingVoyage
vector(1024)`. Documents marcados con su provider. El dropdown elige y la
búsqueda usa la columna correspondiente.

- **Pros:** flexibilidad máxima; no pierdes data; permite migrar
  gradualmente.
- **Contras:** dos proveedores cloud por mantener (OpenAI + Voyage); costo
  de tokens (aunque bajo); más complejidad en código y schema sin
  amortización real para una demo on-prem.

### Opción B — Tabla `ChunkEmbedding(chunkId, provider, model, embedding)`

Un mismo chunk puede tener embeddings de varios providers en paralelo.

- **Pros:** soporta cualquier número de providers sin migración de schema.
- **Contras:** sobre-ingeniería para una demo; multiplica filas; join extra
  en cada búsqueda; nada justifica la complejidad mientras solo haya un
  proveedor activo.

### Opción C — Embeddings on-prem únicos (decidida)

Una columna `vector(768)`, un proveedor, schema simple.

- **Pros:** alineado con el pitch on-prem; cero costo cloud para
  embeddings; código simple; tests fáciles; el demo refuerza el mensaje
  ("si el Mac/Nutanix se cae, el RAG también — porque tu RAG corre
  literalmente sobre tu hardware").
- **Contras:** los 660 chunks viejos se pierden (eran test data); el demo
  RAG depende de la disponibilidad del Mac/túnel; "Anthropic" en el
  dropdown queda como solo-chat sin RAG.

## Consecuencias

### Positivas

- **Cero dependencia cloud para embeddings** — la promesa on-prem queda
  honesta end-to-end.
- **Schema simple:** una columna, un índice HNSW, un proveedor.
- **Costo predecible:** nada en tokens de embeddings.
- **Mensaje comercial reforzado:** el demo es literalmente la demo del
  producto (Nutanix on-prem).

### Negativas / costos

- **Dependencia operacional del Mac/túnel.** Si el gateway FastAPI cae o
  Cloudflare devuelve 502, el demo RAG no funciona. Mitigación: levantar
  el stack local como servicio, monitorearlo (Pulse / un health-check
  externo). En producción real el cliente tiene Nutanix con redundancia,
  no Mac casero — el riesgo es de demo, no de producto.
- **"Anthropic" en el dropdown del header pierde el demo RAG.** La UI lo
  explica con un banner. Los 6 demos restantes siguen disponibles. Trade-
  off aceptable.
- **Los 660 chunks viejos se borran.** Test data, no producción real.
  Confirmado.

### Riesgos / cosas a vigilar

- **Si aparece un cliente real que quiere Voyage AI o OpenAI** (porque
  prefiere cloud o porque su Nutanix no expone embeddings), hay que sumar
  el adapter y migrar el schema a multi-columna. Costo estimado: ~1
  semana incluyendo migración con backfill por provider.
- **`nomic-embed-text` no es state-of-the-art en español.** El 60% del
  contexto de los demos es español ecuatoriano. Si el retrieval da
  resultados pobres, evaluar `bge-m3` (multilingüe, 1024 dim) o el
  modelo multilingüe que NAI / NIM ofrezca. Implicaría una nueva
  migración del schema (dim diferente).

## Plan de migración del repo

Implementado en 4 sub-PRs:

| Sub-PR | Qué cambia                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| 1      | Schema + migración de Postgres (esta migración). Wipe + drop columna vieja + add columna 768 + add metadata. |
| 2      | Backend: `embeddingsFor(provider)` factory; bloqueo de demo RAG cuando `llmProvider=anthropic`.              |
| 3      | Frontend: badge "sin RAG" en Anthropic, banner en `/demo/rag`, bloqueo de upload.                            |
| 4      | Este ADR + runbook con la secuencia exacta para correr la migración en Railway + smoke test end-to-end.      |

## Cuándo revisar

- Si la calidad del retrieval con `nomic-embed-text` resulta insuficiente
  para los demos en español ecuatoriano.
- Si llega un cliente que exige un proveedor cloud específico (Voyage AI,
  OpenAI, Cohere).
- Si NAI / NIM agrega un proveedor de embeddings nativo (no via gateway
  FastAPI custom) con mejor latencia o calidad.

## Referencias

- [`ADR-0008`](./0008-openai-embeddings-for-dev.md) — superado por este
  ADR.
- [`ADR-0004`](./0004-llm-adapter-pattern.md) — patrón Adapter del que
  esta decisión se beneficia (un solo adapter, una sola pieza a cambiar
  el día que sumemos un segundo proveedor).
- [`ADR-0005`](./0005-pgvector-over-dedicated-vector-db.md) — por qué
  pgvector.
- [PR #90](https://github.com/georgenton/ai-demo-platform/pull/90) —
  introdujo el provider `private-mac` que hizo necesario este ADR.
- Migración SQL:
  `packages/db/prisma/migrations/20260608170000_embeddings_onprem_wipe_and_768d/migration.sql`
