# ADR-0002 — NestJS para el backend

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El backend (`apps/api`) es el **orquestador** del Demo 01 y los demos que
siguen. Su trabajo incluye:

- Recibir documentos y hacer el flujo de ingesta (RAG indexing).
- Recibir preguntas, hacer retrieval, armar prompts y hacer streaming
  de la respuesta del LLM.
- Más adelante: tool use / function calling, agentes con acceso a SQL.

Es una app **estructurada** con módulos claros, no un endpoint chico.
También es una app que Jorge va a usar como referencia de buenas
prácticas para mentoría.

## Decisión

**NestJS 11 sobre Node 20.** Estructura modular con DI, decoradores,
SSE streaming nativo, ecosistema maduro.

## Alternativas consideradas

### Opción A — Express puro

- **Pros:** mínimo, conocido por todo el mundo.
- **Contras:** sin estructura impuesta. Para una app que va a tener
  IngestModule + ChatModule + DemoRegistryModule + auth + etc., terminás
  reinventando un framework igual.

### Opción B — Fastify

- **Pros:** rápido, schema-first validation, plugin system.
- **Contras:** menos opinionado que Nest; tendríamos que elegir
  organización de carpetas, DI container, etc.

### Opción C — Hono / Elysia (modernos, livianos)

- **Pros:** muy rápidos, modernos, edge-friendly.
- **Contras:** ecosistema más chico, menos battle-tested en proyectos
  empresariales. Para una base de mentoría, "más obvio" gana.

### Opción elegida — NestJS

- **Por qué ganó:**
  - **Estructura clara** (módulos / controllers / services / DI) — ideal
    como ejemplo pedagógico.
  - **SSE nativo** (`@Sse()`) — el chat con streaming queda limpio.
  - **Class-validator integrado** — DTOs tipados con validación en el
    borde.
  - **Es el `Spring` / `Angular` del mundo Node** — viniendo de un stack
    estructurado, la transición mental es corta.

## Consecuencias

### Positivas

- Estructura obvia, fácil de revisar y enseñar.
- DI hace que los servicios sean testeables fácil.
- Decoradores y módulos hacen explícita la composición.

### Negativas / costos

- Más boilerplate que Express puro (definir módulos, decoradores).
- Para alguien que viene de Express minimalista, puede parecer
  "demasiado framework". Es justo lo que buscamos, pero conviene
  explicarlo.

### Riesgos / cosas a vigilar

- NestJS tiene versiones mayores frecuentes (v10 → v11). Mantenernos al
  día requiere atención.

## Cuándo revisar

- Si el backend evoluciona a algo edge-first (Workers, Vercel Edge) y
  el peso de Nest se vuelve un costo real.
- Si Nest pierde momentum o aparece un sucesor claramente mejor.

## Referencias

- [NestJS — docs](https://docs.nestjs.com/)
- [`docs/architecture/03-components.md`](../architecture/03-components.md)
