# ADR-0001 — Nx monorepo en lugar de múltiples repos

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El proyecto tendrá al menos:

- Un backend (`apps/api`) en TypeScript.
- Un frontend (`apps/web`) en TypeScript.
- Eventualmente, un servicio en Python (`apps/ai-service`).
- Varias librerías compartidas (`packages/db`, `packages/llm-adapter`,
  `packages/rag-core`).

Las librerías son consumidas exclusivamente por las apps internas y van
a cambiar junto con las apps. Cualquier mejora al `LLMAdapter` necesita
una versión específica del `api` para usarse.

## Decisión

**Un único repositorio gestionado con Nx.** Apps en `apps/*`, librerías
en `packages/*`. npm workspaces como manejador de dependencias.

## Alternativas consideradas

### Opción A — Múltiples repos (uno por app/package)

- **Pros:** separación dura, equipos independientes, builds más chicas.
- **Contras:** un cambio coordinado (ej: agregar un campo a `Document`
  en `@org/db` que usa `apps/api`) requiere 2+ PRs, versionado manual,
  publicar a un registry privado.

### Opción B — Monorepo con `pnpm workspaces` o `lerna`

- **Pros:** más simple que Nx.
- **Contras:** sin caché de tareas, sin grafo de dependencias, sin
  generadores. Hay que armar la tooling a mano.

### Opción elegida — Nx monorepo (con npm workspaces)

- **Por qué ganó:** equipo chico (1–2 personas), librerías que cambian
  con las apps, necesidad de generadores para apps Nest/Next, caché de
  tareas valiosa desde el inicio. Nx da todo lo de un monorepo serio
  sin tener que armar la tooling.

## Consecuencias

### Positivas

- Un PR puede tocar `apps/api` + `packages/db` + `packages/rag-core` a
  la vez, de forma atómica.
- Refactors cross-package son posibles sin coordinación de versiones.
- Nx cachea las tareas (`lint`, `typecheck`, `build`) — los CI runs son
  más rápidos en proyectos no afectados.
- Generadores oficiales para Nest, Next y librerías TS.

### Negativas / costos

- Curva de aprendizaje de Nx para quien viene de repos sueltos.
- `npm install` y el lockfile son más grandes (todo en root).
- Los bins de paquetes de workspace no siempre se hoistean — generó
  fricción al instalar Prisma (ver
  [`ADR-0006`](./0006-prisma-6-over-7.md)).

### Riesgos / cosas a vigilar

- Si alguna vez el repo crece a 10+ apps con equipos independientes,
  Nx sigue funcionando, pero podría tener sentido evaluar split.

## Cuándo revisar

- Si entra un equipo independiente que necesita su propio ciclo de
  release sobre un subconjunto del repo.
- Si Nx introduce un cambio mayor incompatible.

## Referencias

- [Nx — concepts](https://nx.dev/concepts)
- [`CLAUDE.md` — Stack tecnológico](../../CLAUDE.md)
