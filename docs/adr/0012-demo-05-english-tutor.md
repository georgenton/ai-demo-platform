# ADR-0012 — Demo 05: Tutor de inglés con calculadora de costo on-prem vs cloud

- **Estado:** Aceptado
- **Fecha:** 2026-05-28
- **Decisores:** Jorge, Edguitar (validó el ángulo comercial)
- **Relacionado:**
  - [ADR-0003](./0003-typescript-first-python-later.md) — TS primero, Python cuando entre NAI.
  - [ADR-0011](./0011-demo-03-waits-for-python.md) — patrón "sprint en TS + LLM" como cierre del Demo 03.
  - [`CLAUDE.md`](../../CLAUDE.md) — los 4 demos del roadmap original.

## Contexto

El catálogo cerró el sprint Demo 03 con 4 demos funcionales: chat
con documentos (01), comparador (02), corpus académico (03), agente
con SQL (04). Los 4 cuentan la misma historia desde ángulos
distintos: **datos del cliente nunca salen del campus**.

Cuando empezamos a preparar la reunión con la universidad ecuatoriana,
apareció una pregunta concreta del lado del cliente:

> "Si nosotros mismos pudiéramos pagarle a OpenAI un chat de inglés
> tipo Loora para nuestros 5.000 alumnos, ¿por qué necesitamos NAI?"

Es la pregunta correcta. Y los 4 demos actuales no la responden de
frente — todos hablan de **privacidad** y **gobernanza**. Ninguno
muestra **el costo** en pantalla.

El stack Anthropic + OpenAI que usamos como mock nos permite medir
tokens reales por sesión y proyectarlos. Si construimos un quinto demo
cuya pieza diferenciadora es **una calculadora de costo en vivo al
lado del chat**, le damos a Edguitar la herramienta para responder
esa objeción con un número, no con un discurso.

El caso de uso que elegimos para el chat es **tutor conversacional
de inglés**, porque:

1. Es un caso que las universidades reconocen — todos los centros
   de idiomas están evaluando o ya pagando una plataforma comercial
   (Duolingo for Schools, ELSA Speak Enterprise, Voxy).
2. El volumen de uso es **predecible y alto**: cientos de alumnos,
   varias sesiones por semana, semestre entero. Eso da números de
   costo que se ven en pantalla.
3. Los productos de referencia (Loora, ELSA) son conocidos pero
   caros — el cliente entiende inmediatamente qué tipo de software
   estamos demostrando.

## Decisión

Construir **Demo 05 — Tutor de inglés conversacional con
calculadora de costo** como quinto demo del catálogo, en stack
TypeScript puro (espejo del enfoque que cerró Demo 03).

**Tres paneles en `/demo/tutor`:**

1. **Chat conversacional.** El LLM mantiene una conversación libre
   en inglés a un nivel ajustable (A1–C1) o dentro de un escenario
   role-play (entrevista de trabajo, ordenar en un café). Streaming
   SSE.
2. **Feedback estructurado.** Tras cada turno del usuario, el panel
   muestra correcciones puntuales (gramática, léxico) y una versión
   "más natural" de la frase. Salida JSON parseado.
3. **Calculadora de costos.** Tres cifras visibles:
   - Tokens usados en esta sesión (in / out, contador en vivo).
   - Costo extrapolado a {alumnos, sesiones/sem, semanas} editable.
   - Comparativa contra "NAI on-prem = $0 variable, solo CapEx
     del hardware". Eso conecta la conversación con Nutanix.

**Entrada de voz: voz nativa del browser** (Web Speech API + Speech
Synthesis). Cero dependencias externas. Coherente con el pitch del
demo — si el chat es para mostrar "esto puede correr sin nube",
introducir Whisper API o ElevenLabs como dependencia del demo sería
incoherente.

**Pricing comparado en pantalla: Anthropic Sonnet.** Es el modelo
que ya usamos como mock; tenemos los números actualizados; y nuestro
discurso comercial es "lo que probaste con Anthropic, en NAI se
sostiene equivalente". Mantenemos el comparativo ajustable en un
archivo de constantes para sumar OpenAI / Gemini si en QA con
Edguitar lo necesitamos.

## Alternativas consideradas

### A — Copiar ELSA Speak (detector fonético)

ELSA usa un modelo ASR entrenado específicamente para detectar
errores de pronunciación fonema a fonema. No es una llamada a un LLM
general — es un modelo dedicado de scoring.

- **Pros:** experiencia más vendible visualmente ("la /θ/ de _think_
  te salió como /t/").
- **Contras:**
  - Reentrenar o licenciar un modelo fonético es un sprint entero
    aparte. No hay dataset trivial que sirva.
  - Vende un demo que **no representa el valor real del producto NAI**.
    El cliente puede pensar que el demo es Loora, no infraestructura
    LLM.
  - Si Edguitar tiene que explicar "esto no incluye fonética porque
    es un proyecto distinto", la promesa se debilita.
- **Por qué se rechazó:** demasiado costo para lo que aporta al
  pitch, y desvía la conversación de "infraestructura LLM" a
  "producto de pronunciación".

### B — Voz con Whisper API + OpenAI TTS

Ofrece calidad pro Loora-level. Habría dos paneles (chat + costo) +
voz hifi.

- **Pros:** demo más impactante en vivo.
- **Contras:**
  - Suma dos dependencias externas que **contradicen el pitch del
    demo** (cero servicios externos para el caso on-prem).
  - El costo variable de Whisper + TTS infla la calculadora en una
    dirección que confunde el mensaje principal ("costo de LLM" vs
    "costo de LLM+ASR+TTS").
  - En producción NAI, ASR/TTS también van on-prem (Whisper local,
    Coqui, etc.) — pero eso es otro proyecto, no este demo.
- **Por qué se rechazó:** coherencia narrativa > calidad de audio.

### C — Solo texto (sin voz)

Implementar el chat + calc sin voz. Reduce ~0.5 día de esfuerzo.

- **Pros:** simplicidad. Más buffer para QA.
- **Contras:** un tutor de inglés sin voz es una experiencia
  truncada. El cliente que conoce Loora/ELSA va a preguntar "¿y la
  voz?" en los primeros 30 segundos.
- **Por qué se rechazó:** la voz nativa del browser es ~30 líneas
  de código sin deps externas. El costo de hacerla es chico y el
  costo de NO hacerla (preguntas obvias del cliente, demo más
  débil) es alto.

### D — Posponer Demo 05 al post-reunión

Pulir los 4 demos existentes y dejar Demo 05 para después.

- **Pros:** menos riesgo de pieza medio terminada para la reunión.
- **Contras:**
  - La objeción "¿por qué no le pagamos a OpenAI directo?" se queda
    sin respuesta en pantalla — Edguitar la responde con palabras,
    no con software.
  - Los 4 demos actuales están sólidos; pulir más es marginal.
- **Por qué se rechazó:** el demo agrega el ángulo comercial que
  ningún otro cubre. Pulir más los 4 actuales no resuelve esa
  objeción.

## Consecuencias

### Positivas

- **El demo responde directo la pregunta "¿por qué no le pagamos a
  OpenAI?"** con un número, no con un discurso. Es la primera vez en
  el portafolio que el costo aparece en pantalla.
- **Habilita un caso de uso vertical concreto.** "Tutor de inglés
  para centros de idiomas" es una venta más fácil de imaginar que
  "plataforma LLM genérica".
- **Reúsa lo que ya tenemos:** `LLMAdapter`, streaming SSE, layout
  de demos, sidebar, i18n, persona prompts pattern (heredado del
  AgentService).

### Negativas / costos

- **Compromiso con números defendibles.** Si decimos "Anthropic
  cobra $3/M input + $15/M output", esa fuente y fecha tienen que
  estar en el código y en el ADR. Pricing changes — el demo
  envejece si no se mantiene.
- **El pitch carga una promesa nueva ("NAI = $0 variable").**
  Edguitar tiene que sostenerla en Q&A con los números de CapEx
  del hardware. Si no los tiene a mano, el demo pierde fuerza.
- **Web Speech API tiene quirks por browser.** Voces de Mac/Chrome
  son decentes; Linux/Firefox menos. Setup del demo: cargar Chrome
  en Mac, listo. Documentado en `runbook-local.md` § Demo 05.

### Riesgos / cosas a vigilar

- **Que el cost calculator sea cuestionado por un CIO afilado.**
  Mitigación: dejamos los inputs editables — el cliente puede meter
  sus propios números y ver el rango.
- **Que la voz falle en vivo.** Mitigación: el chat soporta input
  por teclado siempre — si la voz falla, Jorge tipea y la demo
  continúa.
- **Que el demo dé respuestas inglesas malas porque el LLM se
  desvía.** Mitigación: persona prompt cerrado + nivel ajustable +
  fallback "didn't catch that, try again". QA pass dedicado en PR-E.

## Cuándo revisar

- **Después de la reunión cliente** — feedback directo de la
  audiencia objetivo. Si el demo conecta, lo dejamos `available` y
  lo movemos a categoría primaria.
- **Cuando entre NAI hardware** — actualizar el cost calculator con
  el CapEx real (Edguitar provee el número). Reemplazar "$0
  variable" con la cifra anualizada del hardware amortizado.
- **Si Anthropic cambia pricing** — actualizar
  `pricing.constants.ts` + fecha de captura.

## Referencias

- [`ADR-0011`](./0011-demo-03-waits-for-python.md) — patrón "sprint
  en TS + LLM" reusado acá.
- [Anthropic Sonnet pricing](https://www.anthropic.com/pricing) —
  fuente de los números del cost calculator (a capturar con fecha
  en `apps/api/src/app/tutor/pricing.constants.ts`).
- [MDN — Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
  — capacidades y soporte por browser.
- Productos de referencia: [Loora](https://loora.ai/),
  [ELSA Speak](https://elsaspeak.com/) — para encuadre conceptual,
  no copiados.
