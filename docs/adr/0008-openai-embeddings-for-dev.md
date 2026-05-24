# ADR-0008 — OpenAI text-embedding-3-small como proveedor de embeddings en dev

- **Estado:** Aceptado
- **Fecha:** 2026-05-24
- **Decisores:** Jorge

## Contexto

El RAG necesita un **modelo de embeddings**: convertir cada chunk en un
vector que represente su significado, y guardar esos vectores en pgvector
para hacer búsqueda por similitud.

[`ADR-0004`](./0004-llm-adapter-pattern.md) decidió que **el mismo código**
habla con Anthropic en dev y con NAI en prod, vía un `LLMAdapter`. Eso es
perfecto para `complete()` (chat). El problema: **Anthropic no expone una
API de embeddings**. Necesitamos un segundo proveedor para `embed()` en
dev.

Decisiones acopladas a esta:

- Qué proveedor usar para embeddings en dev.
- Qué dimensión de vector (define la columna `vector(N)` en
  [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)).
- Cómo se compone con el LLMAdapter de `ADR-0004`.

## Decisión

**OpenAI `text-embedding-3-small` (dimensión 1536) para `embed()` en
desarrollo.** Apuntamos a la API oficial de OpenAI vía `OPENAI_API_KEY`.
En producción, `embed()` apunta al endpoint OpenAI-compatible que sirve
NAI (probablemente con otra dimensión — ver "Consecuencias").

## Alternativas consideradas

### Opción A — Voyage AI `voyage-3` (1024 dim)

- **Pros:** suele superar a OpenAI en benchmarks de retrieval; Voyage es
  la embeddings partner recomendada por Anthropic desde la adquisición;
  free tier generoso.
- **Contras:** API distinta a OpenAI/NAI → el adapter dev de embeddings
  diverge del adapter prod. Para una base de mentoría que enseña el
  patrón Adapter, **simetría dev↔prod en el shape de la API es más
  valiosa que un marginal de calidad**.

### Opción B — Local via Ollama (`nomic-embed-text`, 768 dim)

- **Pros:** sin API externa, sin costo recurrente, todo on-prem desde el
  vamos.
- **Contras:** requiere instalar y correr Ollama localmente para cada
  contribuidor → fricción de onboarding alta y dev no replica la forma
  de la prod (que sí va por API REST).

### Opción elegida — OpenAI text-embedding-3-small

- **Por qué ganó:** API OpenAI-compatible (misma forma que NAI en prod →
  adapter casi simétrico, solo cambian `baseURL` y `apiKey`). Calidad
  excelente, costo casi cero ($0.02 / 1M tokens — los demos consumen
  tokens en órdenes de magnitud despreciables), funciona bien en
  español, ecosistema documentadísimo.

## Consecuencias

### Positivas

- **Simetría dev ↔ prod** en la forma de la API. El `EmbeddingsAdapter`
  para dev y prod es casi el mismo código.
- **Tokens baratísimos** — los demos tendrán uso despreciable.
- **Setup de un dev nuevo es trivial**: pedir una `OPENAI_API_KEY` y ya.
- **Multilingual de fábrica** — los documentos institucionales en
  español funcionan sin tunear nada.

### Negativas / costos

- Sumamos un segundo proveedor en dev (Anthropic para chat, OpenAI para
  embeddings). Dos API keys, dos accounts.
- Dependencia de un servicio externo en dev (OpenAI). Si OpenAI cae, los
  embeddings de dev fallan. Aceptable para un PoC.

### Riesgos / cosas a vigilar

- **La dimensión en prod (NAI) va a ser casi seguro distinta.** NAI sirve
  los modelos que la organización del cliente despliega vía NIM — suelen
  ser modelos de 768 o 1024 dim (`all-MiniLM-L6-v2`, `bge-large-en-v1.5`,
  etc.). Cuando se sepa cuál usa el cluster de prod, ese entorno corre
  una migración paralela que cambia `vector(1536)` por `vector(N_prod)`
  y re-embebe los documentos.
- **No compartimos la base vectorial entre entornos.** Cada uno tiene
  sus propios vectores. Es la norma en RAG, no una limitación.
- **Cambiar de modelo en dev también** implica re-embeber. Cambios de
  proveedor son baratos pero no gratis.

## Cuándo revisar

- Si NAI termina sirviendo un modelo OpenAI-compatible que también
  podemos usar en dev (ej: NAI con `text-embedding-3-small`),
  unificamos.
- Si la calidad de OpenAI 3-small resulta insuficiente para nuestros
  documentos (poco probable a este volumen).
- Si el costo crece de forma inesperada (también poco probable).

## Referencias

- [OpenAI Embeddings — docs](https://platform.openai.com/docs/guides/embeddings)
- [pgvector — README](https://github.com/pgvector/pgvector#querying)
- [`ADR-0004`](./0004-llm-adapter-pattern.md) — el patrón Adapter del que
  esta decisión depende.
- [`ADR-0005`](./0005-pgvector-over-dedicated-vector-db.md) — por qué
  pgvector.
