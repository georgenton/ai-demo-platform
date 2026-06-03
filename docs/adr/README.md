# Architecture Decision Records (ADRs)

Cada archivo numerado en esta carpeta es un **ADR**: una decisión técnica
importante del proyecto, capturada con su contexto.

## ¿Por qué ADRs?

Las decisiones técnicas grandes se olvidan rápido. Tres meses después,
alguien va a preguntar _"¿por qué Prisma 6 si v7 existe?"_ o _"¿por qué
pgvector y no Pinecone?"_. Sin ADRs, la respuesta queda en la cabeza de
quien la tomó (o se pierde).

Un ADR es un archivo corto que captura:

- El **contexto** (qué problema estábamos resolviendo).
- La **decisión** (qué se eligió).
- Las **alternativas consideradas** (qué se descartó y por qué).
- Las **consecuencias** (qué nos cuesta o nos habilita).

## Formato

Usamos **MADR** (Markdown ADR), uno de los formatos estándar:

- Archivos numerados secuencialmente: `XXXX-titulo-en-kebab-case.md`.
- Plantilla en [`0000-template.md`](./0000-template.md).

## Índice

| #    | Título                                                                                                            | Estado                      |
| ---- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0001 | [Nx monorepo over multiple repos](./0001-nx-monorepo.md)                                                          | Aceptado                    |
| 0002 | [NestJS for the backend](./0002-nestjs-for-the-backend.md)                                                        | Aceptado                    |
| 0003 | [TypeScript first, Python later](./0003-typescript-first-python-later.md)                                         | Aceptado                    |
| 0004 | [LLM Adapter pattern](./0004-llm-adapter-pattern.md)                                                              | Aceptado                    |
| 0005 | [pgvector over a dedicated vector DB](./0005-pgvector-over-dedicated-vector-db.md)                                | Aceptado                    |
| 0006 | [Prisma 6 over Prisma 7](./0006-prisma-6-over-7.md)                                                               | Aceptado                    |
| 0007 | [Conventional Commits and branch-based PR flow](./0007-conventional-commits-and-pr-flow.md)                       | Aceptado                    |
| 0008 | [OpenAI text-embedding-3-small for dev embeddings](./0008-openai-embeddings-for-dev.md)                           | Aceptado                    |
| 0009 | [Split LLMAdapter into ChatAdapter + EmbeddingsAdapter](./0009-split-llm-adapter.md)                              | Aceptado                    |
| 0010 | [Web/API coupling: Next.js rewrites + duplicated types](./0010-web-api-coupling-rewrites-and-no-contracts-pkg.md) | Aceptado                    |
| 0011 | [Demo 03 (corpus académico) espera a la entrada de Python](./0011-demo-03-waits-for-python.md)                    | Superado por sprint Demo 03 |
| 0012 | [Demo 05 — Tutor de inglés con cost calculator](./0012-demo-05-english-tutor.md)                                  | Aceptado                    |
| 0013 | [Multi-tenant SaaS architecture (soft tenancy con tenantId)](./0013-multi-tenant-saas-architecture.md)            | Aceptado                    |
| 0014 | [Auth: email + contraseña con JWT en cookie httpOnly](./0014-auth-email-password-jwt.md)                          | Aceptado                    |
| 0015 | [Multi-tenant: notas de implementación del sprint MT1..MT5](./0015-multi-tenant-implementation-notes.md)          | Aceptado                    |

## Cuándo agregar un nuevo ADR

Cuando alguno de estos pasa:

- Estás eligiendo entre opciones técnicas con trade-offs reales (ej:
  framework, librería, patrón).
- Estás revirtiendo o cambiando una decisión previa.
- En un PR review, la pregunta _"¿por qué se hizo así?"_ no tiene
  respuesta inmediata.

## Cómo agregar un ADR

1. Copia [`0000-template.md`](./0000-template.md) a
   `XXXX-tu-decision.md` (número correlativo, kebab-case).
2. Completa las secciones.
3. Agrega la fila al índice de arriba.
4. Commitea con `docs(adr): add ADR-XXXX <titulo>`.

## Estados posibles

| Estado        | Significado                                               |
| ------------- | --------------------------------------------------------- |
| **Aceptado**  | La decisión está en vigor.                                |
| **Superado**  | Hay un ADR más nuevo que lo reemplaza. Linkea al sucesor. |
| **Rechazado** | Se consideró pero no se adoptó.                           |
| **Propuesto** | En discusión, no decidida aún.                            |

> Los ADRs **no se borran ni se editan retroactivamente** una vez
> aceptados. Si la decisión cambia, se escribe un nuevo ADR que la
> "supera" — el viejo queda como registro histórico.
