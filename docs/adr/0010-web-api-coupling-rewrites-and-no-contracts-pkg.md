# ADR-0010 — Frontend/backend coupling: Next.js rewrites + tipos duplicados

- **Estado:** Aceptado
- **Fecha:** 2026-05-26
- **Decisores:** Jorge

## Contexto

Al armar la capa de cliente HTTP del Demo 01 en `apps/web` (PR #12),
había que tomar dos micro-decisiones acopladas:

1. **¿Cómo le habla el browser al backend NestJS?**
   - Opción A: el frontend pega contra `http://localhost:3000/...`
     directamente y el backend habilita CORS.
   - Opción B: el frontend pide a `/api/...` (mismo origen) y Next.js
     proxea internamente al backend.

2. **¿Dónde viven los tipos del contrato API (DTOs)?**
   - Opción A: paquete compartido `@org/contracts` con los tipos puros,
     consumido por `apps/api` y `apps/web`.
   - Opción B: los tipos viven duplicados — los DTOs reales en
     `apps/api` con decoradores de `class-validator`, y un espejo
     manual en `apps/web/src/lib/api/types.ts`.

Las dos decisiones están relacionadas porque ambas tocan _cuánto se
acopla el frontend al backend en dev-time_.

## Decisión

**(1)** El cliente del frontend usa **URLs relativas** (`/api/v1/...`)
y Next.js las proxea al backend vía
[`rewrites()`](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
en `next.config.js`:

```js
async rewrites() {
  return [
    { source: '/api/:path*', destination: `${API_PROXY_TARGET}/api/:path*` },
  ];
}
```

El destino se controla con la variable `API_PROXY_TARGET` (default
`http://localhost:3000` para dev). En producción se sobreescribe.

**(2)** Los tipos del contrato **viven duplicados**: los DTOs reales en
`apps/api` con decoradores de `class-validator`, y un espejo manual de
interfaces puras en `apps/web/src/lib/api/types.ts`. Regla operativa:
**si cambiás un DTO del backend, actualizá el archivo del frontend en
el mismo PR.**

## Alternativas consideradas

### Para el coupling browser ↔ backend

- **A — CORS directo (browser pega a `:3000`)**
  - **Pros:** explícito, no hay "magia" del framework.
  - **Contras:** hay que mantener una lista de orígenes permitidos en
    el backend; cada entorno (dev, staging, prod) suma uno; preflight
    extra en cada request; un origen mal configurado mata el demo en la
    presentación. Para una app que **siempre va a vivir detrás del mismo
    dominio que su frontend**, es ceremonia neta.

### Para el contrato de tipos

- **A — Paquete `@org/contracts` compartido**
  - **Pros:** una sola fuente de verdad; el compilador detecta drift.
  - **Contras hoy:** los DTOs del backend están atados a decoradores de
    `class-validator` que no tienen sentido en el browser. Habría que
    separar "tipos puros" de "DTOs con validación", lo cual implica
    duplicación interna (un type + una clase con decoradores). Para
    cuatro tipos (`IngestTextRequest`, `IngestResponse`, `ChatQuery`,
    `IngestFileRequest`) es complejidad especulativa — regla #5 de
    `CLAUDE.md`.

- **B — Generación automática desde el OpenAPI del backend**
  - **Pros:** sin drift posible.
  - **Contras hoy:** Nest no tiene un OpenAPI vivo todavía; agregarlo
    es un mini-proyecto (`@nestjs/swagger` + decoradores en cada DTO).
    Vale la pena cuando haya 20+ tipos, no 4.

## Por qué ganaron las elegidas

**Rewrites en lugar de CORS:** el frontend y el backend se despliegan
siempre juntos (vienen del mismo monorepo, con el mismo ciclo de
deploy). El browser nunca tiene que ver al backend como un origen
ajeno — son el mismo sistema. Rewrites elimina toda la maquinaria CORS
sin perder nada.

**Tipos duplicados (por ahora):** para 4 interfaces, una regla simple
(_actualizá ambos archivos en el mismo PR_) cuesta menos que un
paquete con sus build steps, sus dependencias entre apps y la
separación type/DTO. Cuando Demos 02–04 hagan crecer el contrato y la
fricción se note (drift real entre PRs, no solo teórico), extraemos.

## Consecuencias

### Positivas

- **Cero CORS en código.** Ni preflights, ni listas de orígenes, ni
  `next-env`-style hackery.
- **El cliente del frontend es portable entre entornos.** El mismo
  código corre en dev (`localhost:3000`), staging y prod cambiando
  solo la variable de Next.js.
- **No bloqueamos la creación del frontend** esperando un paquete
  `@org/contracts` que hoy no aporta valor.

### Negativas / costos

- **Drift potencial entre los DTOs del backend y el espejo del
  frontend.** Mitigado con la regla "ambos archivos en el mismo PR" y
  con CI (typecheck + tests del cliente). Es un costo manual, no
  enforced por el compilador.
- **El proxy de Next.js agrega un hop en dev.** Latencia menor (Next
  está en el mismo host) — irrelevante.

### Riesgos / cosas a vigilar

- **Si en producción el backend vive en otro dominio que el frontend**
  (ej. `api.empresa.com` ↔ `app.empresa.com`), las rewrites tienen que
  apuntar a ese host con `API_PROXY_TARGET`. Si igual queremos llamada
  directa cross-origin, **ahí sí** entra CORS — y esta decisión se
  revisa.
- **Cuando aparezca el quinto tipo del contrato** (Demo 02 trae al
  menos `CompareRequest`, `CompareResponse`), considerar extraer
  `@org/contracts`.

## Cuándo revisar

- Cuando el frontend tenga que vivir en un dominio distinto al backend
  y no podamos proxear desde el mismo Next.
- Cuando los tipos del contrato pasen de ~5 a 10+ — la fricción de
  mantenerlos duplicados empieza a pesar.
- Cuando aparezca un cliente que no sea el frontend de este monorepo
  (CLI, mobile, integración de terceros) — ahí un OpenAPI o un paquete
  shareable se vuelve mucho más útil.

## Referencias

- [Next.js rewrites docs](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- PR #12 — implementación inicial del cliente HTTP y rewrites.
- `apps/web/next.config.js`, `apps/web/src/lib/api/`.
