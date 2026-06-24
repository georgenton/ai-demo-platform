# ADR-0022 — Multi-provider LLM por tenant (Mac dev / Ubuntu on-prem / Anthropic)

- **Estado:** Aceptado
- **Fecha:** 2026-06-24
- **Decisores:** Jorge, Edguitar

## Contexto

El proyecto siempre tuvo la promesa "mismo código, dos backends": Anthropic
para dev y NAI on-premise para producción. La realidad de los demos
comerciales con cooperativas y universidades sumó dos matices:

1. **NAI todavía no está en manos del cliente.** El hardware Nutanix está
   disponible para pruebas con Edguitar, pero los clientes que vemos
   primero quieren ver _algo_ corriendo on-prem en hardware barato antes
   de comprar Nutanix. La pregunta concreta: _"¿puedo probar este sistema
   en un Ubuntu con CPU mientras evalúo NAI?"_.
2. **La demo en vivo necesita switch instantáneo.** En la reunión con
   cliente queremos poder cambiar el provider en frente del comprador
   sin redeploy: clic en /admin/tenant → guardar → próxima pregunta usa
   el provider nuevo.

El adapter ya tenía cuatro variantes (`anthropic`, `openai-compat`,
`private-mac`, `fake`) configuradas por env var global `CHAT_PROVIDER`.
Faltaban dos piezas:

- Una variante semánticamente nueva: **`private-onprem`** = servidor
  Linux del cliente (Ubuntu con Ollama o vLLM) — distinta de
  `private-mac` que es el Mac M1 de dev local de Jorge.
- **Switch por tenant**, no por env global, para que el demo
  multi-cliente pueda mostrar coexistencia.

## Decisión

1. **Sumar `private-onprem` al enum de providers** del `chat-adapter` y
   `embeddings-adapter`. Lee `ONPREM_LLM_BASE_URL`,
   `ONPREM_LLM_MODEL`, `ONPREM_LLM_API_KEY` con fallback a las `CHAT_*`
   genéricas, mismo patrón que `private-mac`.
2. **Agregar `Tenant.llmProvider`** (nullable `String`). Cuando está
   poblado, gana sobre `CHAT_PROVIDER` env var. Cuando es `null`, el
   sistema cae al env var. Valores válidos:
   `'anthropic' | 'openai-compat' | 'private-mac' | 'private-onprem'`.
3. **UI de cambio en `/admin/tenant`**, accesible solo al rol
   `superadmin`. Cada opción describe el caso de uso, no solo el nombre
   técnico.
4. **Sin demo nuevo en el catálogo.** Este es un cambio de
   infraestructura que habilita todos los demos existentes — no aparece
   en `/` ni en el sidebar.

## Alternativas consideradas

### Opción A — Renombrar `private-mac` → `private-onprem`

- **Pros:** Una sola variante on-prem; código más simple.
- **Contras:** El stack de dev (Mac M1 con Ollama corriendo directo) y
  el stack del cliente (Ubuntu CPU con Ollama servido por systemd) son
  distintos en latencia y modelos disponibles. Mismo bucket borra la
  historia comercial de "tres entornos".

### Opción B — Provider por industria (no por tenant)

- **Pros:** Refleja el caso de uso real (cooperativas tienden a
  on-prem, universidades a cloud).
- **Contras:** Demasiado rígido. Hay cooperativas que quieren cloud
  para PoC y universidades que ya tienen su Ubuntu listo. La
  granularidad por tenant cubre los dos casos sin perder nada.

### Opción C — Solo env var global (lo que ya existe)

- **Pros:** Cero cambio de schema.
- **Contras:** No podemos mostrar dos tenants con providers distintos
  en el mismo deploy. Mata el demo "este cliente está en cloud, este
  otro on-prem, los dos en la misma plataforma".

### Opción elegida — Switch por tenant + `private-onprem` nuevo

- **Por qué ganó:** Es el mínimo cambio que habilita la historia
  comercial completa sin romper compatibilidad. `Tenant.llmProvider`
  nullable significa que tenants existentes siguen funcionando con la
  env var global; los nuevos pueden sobrescribir.

## Consecuencias

### Positivas

- El sales pitch _"mismo código, tres entornos"_ deja de ser hipotético.
- Demos en vivo pueden mostrar el switch en frente del cliente sin
  redeploy.
- Cada cliente puede arrancar en Anthropic (más fácil) y migrar a
  on-prem cuando esté listo, sin tocar código.

### Negativas / costos

- Suma una variante más al adapter (sumo, no rompo nada).
- El `TenantConfigService` que resuelve el provider tiene que mirar
  primero la DB y luego el env como fallback — un punto más de lookup.

### Riesgos / cosas a vigilar

- **Cache vs. cambio en vivo:** si el `ChatAdapter` se instancia una
  vez por proceso, cambiar `Tenant.llmProvider` no se refleja hasta el
  próximo restart. Solución en sub-PR 2: factory que resuelve por
  request (cheap) en lugar de singleton por proceso.
- **Compatibilidad con tests:** los tests del adapter que usan
  `CHAT_PROVIDER=anthropic` siguen funcionando porque `null` en DB
  cae al env var. Pero los tests de integración del backend que ya
  tocan `Tenant` tendrán que setear `llmProvider` explícitamente o
  confiar en el default.

## Cuándo revisar

- Cuando NAI esté instalado en hardware Nutanix real y queramos
  diferenciar `private-onprem` (Ubuntu del cliente) de `nai`
  (Nutanix Enterprise AI). Probable que se agregue `'nai'` como
  cuarta variante on-prem con su propio bloque de env vars.
- Si la latencia de Ollama en CPU se vuelve un problema real: ahí
  agregamos una columna `Tenant.llmModel` para permitir elegir
  modelo más liviano por tenant.

## Implementación entregada (sub-PRs 1–3)

- **Sub-PR 1** — schema (`Tenant.llmProvider String?` + migración) y
  ADR aceptado.
- **Sub-PR 2** — `PrivateOnpremChatAdapter` + `PrivateOnpremEmbeddingsAdapter`,
  `'private-onprem'` sumado a `ChatProvider`/`EmbeddingsProvider`, env
  vars `ONPREM_LLM_*` + tests.
- **Sub-PR 3** — UI en `/admin/tenant` con radio de 5 opciones,
  endpoint `PATCH /api/v1/admin/tenant` extendido con `llmProvider`,
  propagación al frontend vía `useMyDemos` que cachea el provider en
  `localStorage` (`adp-tenant-llm-provider`) y `getActiveLlmProvider()`
  cae a él cuando no hay override manual. Runbook
  `docs/runbook-demo-onprem.md` con guía Ubuntu + Ollama.
