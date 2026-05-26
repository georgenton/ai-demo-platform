# ADR-0011 — Demo 03 (corpus académico) espera a la entrada de Python

- **Estado:** Aceptado
- **Fecha:** 2026-05-26
- **Decisores:** Jorge
- **Relacionado:** [ADR-0003](./0003-typescript-first-python-later.md) — esa decisión definió que Python entra _cuando_ y _dónde_ aporta valor real; este ADR lo aplica al caso concreto de Demo 03.

## Contexto

Mientras avanzábamos con los demos 02 y 04 en TypeScript, surgió la
pregunta de qué hacer con **Demo 03 — Analizador de corpus académico**.

El tagline del demo: _"Busca tendencias en 500 tesis de los últimos 5
años"_. La propuesta de valor no es responder una pregunta sobre un
documento (Demo 01) ni comparar dos contratos (Demo 02): es procesar
una **colección grande** y extraer patrones agregados.

Concretamente, lo que el demo necesita hacer bien:

- Extraer texto de PDFs académicos (muchos vienen escaneados — OCR).
- Embeddear cientos o miles de documentos sin pagar a una API por
  cada uno (modelos locales tipo `sentence-transformers`).
- Análisis estadístico del corpus: frecuencias de términos, clustering
  temático, evolución temporal — territorio natural de pandas / numpy
  / scikit-learn.

El stack TypeScript actual puede simular esto secuencialmente con la
API de OpenAI para embeddings y Anthropic para análisis, pero:

- **Costo:** llamar a OpenAI 500 veces por embedding y a Anthropic
  varias veces para análisis sube el costo lineal con el corpus. Un
  demo con 500 tesis se vuelve económicamente serio para un demo.
- **Latencia:** sin batch local ni paralelismo agresivo, procesar 500
  documentos en Node es horas, no minutos.
- **Calidad del análisis estadístico:** hacer agregaciones tipo
  "tendencias por año" o "clusters temáticos" en TS implica
  reimplementar a mano lo que pandas + sklearn ya resuelven.

ADR-0003 ya había anticipado esta tensión: _"Python entra cuando NAI
esté disponible y para tareas donde Python gana — procesamiento
masivo, modelos locales, análisis estadístico de corpus"_. Demo 03
cae exactamente en esa lista.

## Decisión

**Posponer Demo 03 hasta que entre `apps/ai-service` en FastAPI.**

Concretamente:

1. El demo queda en el `DemoRegistryService` con `status: 'coming-soon'`
   (es donde ya está) — el frontend lo muestra deshabilitado, junto a
   Demos 02 y 04 mientras esos no tengan UI.
2. **No** se escribe módulo NestJS, endpoint, ni stub. Cero código de
   Demo 03 en el backend TS, para que cuando llegue FastAPI no haya
   código fantasma que pensar si borrar o migrar.
3. Cuando entre `apps/ai-service`, este ADR se actualiza con un link a
   la implementación y al ADR que documente el setup Python.

Demo 02 (Comparator) y Demo 04 (Agent) **sí** se hacen en TS — son los
casos donde el stack actual gana o empata.

## Alternativas consideradas

### Opción A — Versión "lite" en TypeScript hoy

Implementar Demo 03 como un loop secuencial: embed via OpenAI, análisis
via Anthropic, sin batch ni stats locales.

- **Pros:** algo para mostrar al cliente sin esperar a Python.
- **Contras:**
  - Va a ser lento y caro a cualquier escala medianamente realista.
  - Cuando entre Python, hay que **reescribirlo completo** — el código
    TS no sirve como base.
  - Vende un demo que no representa el valor real ("solo procesa 10
    tesis en 5 minutos"). Eso es peor que no mostrarlo todavía.
  - Va contra ADR-0003 sin haberla refutado.

### Opción B — Stub de contrato (endpoint que devuelve 501)

Crear el módulo NestJS con DTOs y endpoint, pero el service devuelve
`NotImplementedException`. El frontend puede diseñar contra el
contrato hoy.

- **Pros:** habilita trabajo de UI en paralelo.
- **Contras:**
  - Para que el contrato sea útil, hay que diseñarlo bien — y diseñarlo
    bien requiere saber qué resultados produce Python. Hoy estamos
    adivinando.
  - El frontend tampoco está bloqueado: Claude Design tiene Demos 02
    y 04 esperando antes que 03.
  - "Endpoint que tira 501" es exactamente la complejidad especulativa
    que CLAUDE.md regla #5 pide evitar.

### Opción elegida — Skip + ADR

- **Por qué ganó:** respeta ADR-0003, no genera código que va a
  reescribirse, no crea expectativas falsas con el cliente, y deja
  trazabilidad de por qué este demo todavía no existe.

## Consecuencias

### Positivas

- **No hay deuda de migración.** Cuando entre Python, partimos de
  cero con el stack correcto, sin código TS que limpiar.
- **El catálogo (`/api/v1/demos`) sigue mostrando los 4 demos del
  roadmap** — el cliente ve la visión completa, solo que Demo 03 está
  marcado como `coming-soon` igual que los otros que aún no tienen UI.
- **Fuerza la conversación sobre Python en el momento adecuado** (cuando
  Edguitar nos dé acceso al hardware NAI), no antes.

### Negativas / costos

- **El backend tiene una "ausencia visible"**: el registry promete
  Demo 03 pero no hay módulo para él. Mitigación: este ADR + el campo
  `status: 'coming-soon'` lo explica.
- **Si la reunión con el cliente cae antes de que entre Python**,
  Demo 03 se presenta solo como concepto (slide/visión), no como
  software corriendo. Aceptable: el deck de demos vivos lo cubren
  01 + 02 + 04.

### Riesgos / cosas a vigilar

- **Que Python tarde más de lo esperado.** Si el acceso a NAI se
  retrasa más de un par de meses y el demo se vuelve urgente, este
  ADR se revisa. La opción "lite en TS" sigue sobre la mesa, pero con
  ojos abiertos sobre el costo de reescritura.
- **Que el contrato del endpoint cambie sustancialmente entre lo que
  imaginamos hoy y lo que Python termine devolviendo.** Por eso no
  fijamos contrato todavía.

## Cuándo revisar

- Cuando Edguitar confirme acceso a hardware NAI → tirar PR que crea
  `apps/ai-service` (FastAPI) y mover `status` de Demo 03 a
  `available` cuando funcione.
- Si el deadline del cliente se mueve y Demo 03 se vuelve crítico
  antes que Python — reevaluar contra Opción A con expectativas
  ajustadas (corpus chico, demo de concepto).

## Referencias

- [`ADR-0003`](./0003-typescript-first-python-later.md) — la decisión
  general de cuándo entra Python.
- [`CLAUDE.md`](../../CLAUDE.md) — el contexto del proyecto donde
  Demo 03 está descrito como "cuando entra FastAPI Python".
- [`apps/api/src/app/demos/demo-registry.service.ts`](../../apps/api/src/app/demos/demo-registry.service.ts)
  — entrada `corpus` con `status: 'coming-soon'`.
