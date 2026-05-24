# AI Demo Platform

Plataforma de demos incrementales que muestran casos de uso de IA empresarial
sobre **Nutanix Enterprise AI (NAI)** on-premise. Durante el desarrollo
trabajamos contra la API de Anthropic como mock; en producción el mismo
código apunta a NAI cambiando variables de entorno.

**Doble propósito:** demos para clientes (universidades y empresas en Ecuador) +
base de referencia para **mentoría sobre cambio de stack** a TypeScript/RAG.

## Estado actual

| Fase                                                    | Estado         |
| ------------------------------------------------------- | -------------- |
| Scaffolding del monorepo Nx                             | ✅             |
| Tooling de calidad (lint, tests, CI, hooks, changesets) | ✅             |
| Capa de DB del Demo 01 (Postgres + pgvector + Prisma)   | ✅             |
| Implementación del Demo 01 (ingesta + chat)             | 🚧 en progreso |
| Demos 02–04                                             | 🗓️ planeados   |

## Quick start

Requisitos: Node 20+, Docker, npm.

```bash
cp .env.example .env             # variables locales (los defaults ya funcionan)
docker compose up -d --wait      # levanta Postgres + pgvector
npm install                      # deps + hooks + Prisma client (postinstall)
npm run db:migrate               # aplica las migraciones
```

Todos los comandos disponibles están en [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Stack

| Capa          | Tech                                                        |
| ------------- | ----------------------------------------------------------- |
| Monorepo      | Nx 22 (TypeScript)                                          |
| Backend       | NestJS 11 + Webpack                                         |
| Frontend      | Next.js 16 (App Router, React 19)                           |
| DB            | PostgreSQL 17 + pgvector (Docker Compose, `localhost:5434`) |
| ORM           | Prisma 6                                                    |
| LLM           | Anthropic API (dev) → NAI on-prem (prod), vía `LLMAdapter`  |
| Testing       | Vitest                                                      |
| Lint / Format | ESLint 9 + Prettier                                         |
| Git hooks     | Husky + lint-staged + commitlint                            |
| Versionado    | Changesets                                                  |
| CI            | GitHub Actions                                              |

El razonamiento de cada elección está documentado en [`docs/adr/`](./docs/adr/).

## Documentación

| Doc                                          | Para qué                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [`CLAUDE.md`](./CLAUDE.md)                   | Contexto completo del proyecto y decisiones de stack (también guía a Claude Code) |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)       | Cómo trabajar: ramas, commits, hooks, comandos                                    |
| [`docs/architecture/`](./docs/architecture/) | Manual de arquitectura siguiendo el modelo **C4**                                 |
| [`docs/adr/`](./docs/adr/)                   | Bitácora de decisiones técnicas (ADRs)                                            |
| [`docs/glossary.md`](./docs/glossary.md)     | Glosario: RAG, embeddings, chunks, etc.                                           |
