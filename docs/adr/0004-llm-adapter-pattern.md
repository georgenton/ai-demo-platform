# ADR-0004 — Patrón Adapter para el LLM (Anthropic ↔ NAI)

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El proyecto consume un LLM. En dev usamos la API de Anthropic; en
producción, **el mismo código** debe apuntar a NAI on-prem (NIM) sin
cambiar lógica de negocio. NAI expone una API compatible con OpenAI.

Sin abstracción, los módulos de negocio (IngestModule, ChatModule)
acoplarían su código al SDK de Anthropic, y el switch a NAI sería un
refactor doloroso a último momento.

## Decisión

**Toda llamada al LLM pasa por un `LLMAdapter`** definido en
`packages/llm-adapter`. Una interface unificada con (al menos):

- `complete(prompt): AsyncIterable<string>` — streaming de tokens.
- `embed(text): Promise<number[]>` — embeddings.

Dos implementaciones intercambiables: `AnthropicAdapter` y `NaiAdapter`.
La elección se hace al arrancar la app, vía la variable de entorno
`LLM_PROVIDER`. Ningún otro módulo importa el SDK del proveedor directo.

## Alternativas consideradas

### Opción A — Llamar al SDK de Anthropic desde los módulos

- **Pros:** menos código, sin abstracción extra.
- **Contras:** acoplamiento total al provider. El switch a NAI requiere
  refactorar cada módulo que toca el LLM. Justo lo que queremos evitar.

### Opción B — Usar directamente el SDK de OpenAI (porque NAI es OpenAI-compatible)

- **Pros:** sin adapter necesario, ya que NAI implementa la interface
  OpenAI.
- **Contras:** Anthropic NO es OpenAI-compatible. Tendríamos que armar
  un proxy local que traduzca Anthropic → OpenAI durante dev. Es el
  mismo trabajo del adapter, peor distribuido.

### Opción C — Una librería tipo LangChain que abstrae providers

- **Pros:** ya existe.
- **Contras:** dependencia gigante para una superficie que necesitamos
  muy chica (complete + embed). Y la abstracción la hacen _ellos_, no
  nosotros — perdemos control.

### Opción elegida — Adapter propio

- **Por qué ganó:** superficie chica, 100% bajo nuestro control, ejemplo
  pedagógico claro del patrón Adapter.

## Consecuencias

### Positivas

- **Switch a NAI = una variable de entorno.** Cero cambios de lógica.
- Testing mejor: podemos inyectar un `MockAdapter` en tests sin tocar
  los módulos.
- Si mañana sumamos un tercer provider, es una clase nueva, no un
  refactor.

### Negativas / costos

- Una capa de indirección extra (chica, manejable).
- Hay que mantener la interface alineada con lo que necesitan los
  módulos de negocio — si NAI no expone algo que Anthropic sí (o
  viceversa), hay que decidir qué hacer.

### Riesgos / cosas a vigilar

- Anthropic y NAI/OpenAI tienen modelos de tool-use / function-calling
  distintos. Cuando llegue el Demo 04 (agente con SQL), el adapter
  necesitará una interfaz para eso que se mapee a ambos.

## Cuándo revisar

- Si las dos APIs divergen tanto que el adapter se vuelve más complejo
  que tener implementaciones separadas por demo.
- Si entra un tercer provider con un modelo radicalmente distinto.

## Referencias

- [`CLAUDE.md` — Estrategia mock → producción](../../CLAUDE.md)
- [`docs/architecture/02-containers.md`](../architecture/02-containers.md)
- [`docs/architecture/03-components.md`](../architecture/03-components.md)
