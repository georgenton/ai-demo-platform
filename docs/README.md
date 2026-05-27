# Documentación

Toda la documentación del proyecto vive en esta carpeta. La intención es que
cualquier persona —developer nuevo, mentee, lector externo— encuentre rápido
lo que necesita y entienda **por qué** las cosas están como están.

## Contenido

| Carpeta / archivo                        | De qué trata                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`architecture/`](./architecture/)       | Manual de arquitectura siguiendo el modelo **C4** (Context → Containers → Components → Runtime flows).                          |
| [`adr/`](./adr/)                         | **Architecture Decision Records**: cada decisión técnica importante con su contexto, alternativas consideradas y consecuencias. |
| [`runbook-local.md`](./runbook-local.md) | Paso a paso para levantar la stack en una máquina nueva y trabajar día a día (servicios, DB, tests, troubleshooting).           |
| [`demo-script.md`](./demo-script.md)     | Guion de demo para presentaciones a clientes: checklist pre-reunión, flujo paso a paso por demo, preguntas duras con respuesta. |
| [`glossary.md`](./glossary.md)           | Términos del dominio (RAG, embeddings, chunking, etc.) en lenguaje simple.                                                      |

## Por dónde empezar

- **Sos developer nuevo en el proyecto:**
  [`/README.md`](../README.md) → [`runbook-local.md`](./runbook-local.md)
  para levantar la stack → [`/CONTRIBUTING.md`](../CONTRIBUTING.md) para
  el flujo de PRs → [`architecture/`](./architecture/) para el diseño.
- **Sos mentee viniendo de otro stack:**
  [`glossary.md`](./glossary.md) primero, después
  [`architecture/01-system-context.md`](./architecture/01-system-context.md) y
  bajá los niveles a tu ritmo.
- **Vas a presentar la demo a un cliente:**
  [`demo-script.md`](./demo-script.md) — checklist, guion paso a paso,
  preguntas duras.
- **Querés entender una decisión de diseño:**
  la bitácora en [`adr/`](./adr/).

## Cómo agregar documentación

- **¿Una nueva decisión técnica?** Agregá un ADR. Plantilla y proceso en
  [`adr/README.md`](./adr/README.md).
- **¿Un cambio estructural en el sistema?** Actualizá el archivo de C4 que
  corresponda (nivel 2 si toca containers, nivel 3 si toca componentes…).
- **¿Un término nuevo del dominio?** Sumalo al glosario.

> Regla práctica: si la pregunta _"¿por qué se hizo X así?"_ aparece en un PR
> review, la respuesta probablemente merece quedar en un ADR.
