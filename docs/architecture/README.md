# Arquitectura

El proyecto documenta su arquitectura siguiendo el **modelo C4** de Simon
Brown. C4 es como **Google Maps zoomeando**: te muestra el sistema desde
afuera y vas bajando en detalle a medida que lo necesitás.

## Los niveles

| Nivel             | Pregunta que responde                                      | Documento                                        |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| 1. System Context | ¿Qué hace el sistema y con quién/qué interactúa?           | [`01-system-context.md`](./01-system-context.md) |
| 2. Containers     | ¿Qué piezas grandes corren? (apps, DB, servicios externos) | [`02-containers.md`](./02-containers.md)         |
| 3. Components     | ¿Qué hay dentro de cada container?                         | [`03-components.md`](./03-components.md)         |
| 4. Code           | _Omitido_ — el código mismo es la fuente.                  | —                                                |

Adicionalmente:

| Doc                                            | De qué trata                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`04-runtime-flows.md`](./04-runtime-flows.md) | Diagramas de **secuencia** para los flujos clave: ingesta de PDFs y chat con streaming. |

## Cómo leer estos documentos

- Si **acabás de llegar**, leelos en orden 1 → 2 → 3.
- Si querés entender **cómo se comportan las cosas** (no solo cómo están
  cableadas), saltá al [`04-runtime-flows.md`](./04-runtime-flows.md).
- Si **algo está raro o no coincide con el código**, abrí un PR para
  actualizarlo. Estos docs son la "vista oficial" — si divergen del código,
  los docs son el bug.

## Por qué C4

- **Para mentees:** podés entender el sistema al nivel que necesités sin que
  te tiren todo el detalle de golpe.
- **Para PRs estructurales:** un cambio debería poder mapearse a un nivel
  C4. Si no se puede, capaz mete demasiadas cosas distintas.
- **Para conversar con no-técnicos** (Edguitar, clientes): el nivel 1 alcanza.

## Notación

Los diagramas usan **Mermaid** (`C4Context`, `C4Container`, `C4Component`,
`sequenceDiagram`). GitHub los renderiza nativos — no hace falta Lucidchart
ni PlantUML. Convenciones:

- **Persona** = actor humano.
- **System** / **Container** / **Component** = unidad de software/infra
  bajo nuestro control.
- **\_Ext** = fuera de nuestro control (Anthropic, NAI).
- **Flecha** = relación o llamada, con la tecnología arriba (REST, SQL, SSE…).

> Las decisiones técnicas concretas viven en los [`ADRs`](../adr/), no acá.
> Los docs de arquitectura responden _"qué"_ y _"cómo"_; los ADRs responden
> _"por qué"_.
