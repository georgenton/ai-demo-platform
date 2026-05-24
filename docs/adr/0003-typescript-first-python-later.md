# ADR-0003 — TypeScript primero, Python progresivamente

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El ecosistema natural de IA es Python: `sentence-transformers`, `pandas`,
`PyMuPDF`, modelos locales de HuggingFace, etc. Sin embargo:

- El hardware NAI está disponible en el corto plazo, no hoy.
- Mientras tanto, usamos LLMs vía API (Anthropic) — eso se hace cómodo
  desde cualquier lenguaje.
- El frontend (Next.js) ya impone TypeScript.
- Jorge está consolidando su stack en Node/TypeScript.

## Decisión

**TypeScript puro para el Demo 01 y 02.** Python (`apps/ai-service` con
FastAPI) entra **cuando llegue el hardware NAI** y haga falta para
tareas donde Python claramente gana (PDFs complejos, embeddings locales,
batch).

## Alternativas consideradas

### Opción A — Python desde el día 1

- **Pros:** ecosistema IA más rico de entrada.
- **Contras:** dos stacks paralelos sin razón clara todavía. El frontend
  hablaría con Python por HTTP igual.

### Opción B — TypeScript puro, nunca Python

- **Pros:** un solo stack para todo, simplicidad máxima.
- **Contras:** cuando llegue NAI y queramos procesar PDFs escaneados,
  análisis estadístico de corpus, embeddings con modelos locales,
  TypeScript no tiene paridad de ecosistema.

### Opción elegida — TypeScript primero, Python progresivamente

- **Por qué ganó:** evitamos complejidad especulativa, pero dejamos la
  puerta abierta donde Python suma valor real. La regla de decisión
  por tarea está en [`CLAUDE.md`](../../CLAUDE.md).

## Consecuencias

### Positivas

- Demo 01 y 02 viven en un solo stack — onboarding más simple.
- Curva de aprendizaje concentrada en TypeScript para Jorge.
- Cuando entre Python, será para tareas donde claramente paga.

### Negativas / costos

- Algunas tareas (extracción avanzada de PDFs) las hacemos más básicas
  en TS hasta que entre Python.
- Cross-stack communication (NestJS ↔ FastAPI por HTTP) hay que diseñar
  con cuidado cuando llegue.

### Riesgos / cosas a vigilar

- Si descubrimos que necesitamos Python antes (ej: el cliente exige
  PDFs escaneados desde el Demo 01), la decisión se adelanta.

## Cuándo revisar

- Cuando llegue el hardware NAI y entre el primer caso real de
  procesamiento batch o PDFs complejos.

## Referencias

- [`CLAUDE.md` — Decisión arquitectónica: stack híbrido TS + Python](../../CLAUDE.md)
- [`docs/architecture/02-containers.md`](../architecture/02-containers.md)
