# Handoff Codex — Demo 08 sub-PR 5 (Notarización · Frontend Next.js)

> **Cómo usar este documento.** Léelo y verifica las secciones reproducibles.
> Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Quinto y último sub-PR del tren ADR-0019. **Frontend Next.js** del demo 08
— la página `/demo/notarize` y sus componentes. Conecta a los 4 endpoints
que entregó el sub-PR 4.

### Stacked sobre sub-PR 4

Esta rama se basa en `feat/demo-08-notarize-pr-4-backend` (PR #103). Si #103
se mergea antes, GitHub recalcula la base a `main`.

### Archivos tocados

| Archivo                                                     | Cambio                                                                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/api/types-notarize.ts`                    | Tipos espejo del backend: `NotarizedDocType`, `NotarizeMode`, `AnchorSummary`, `DocumentAnalysis`, `NotarizedDocument`, etc.                                                                       |
| `apps/web/src/lib/api/notarize.ts`                          | Cliente HTTP: `uploadNotarize`, `listNotarized`, `getNotarized`, `verifyNotarized`. Usa `fetch` + `extractErrorMessage`.                                                                           |
| `apps/web/src/lib/api/index.ts`                             | Re-exports.                                                                                                                                                                                        |
| `apps/web/src/lib/api/types.ts`                             | Suma `'notarize'` al union `DemoId`.                                                                                                                                                               |
| `apps/web/src/lib/catalog/demos.ts`                         | Entrada `notarize` en `DEMOS_CATALOG` con icon `shield-check` y 3 audienceKeys.                                                                                                                    |
| `apps/web/src/lib/i18n/strings.ts`                          | Strings ES + EN del demo: `notarize.*`, `notarize.docType.*`, `notarize.mode.*`, `notarize.anchors.*`, `notarize.analysis.*`, `audience.notarize.*`, `demos.notarize.*`, `costMini.uses.notarize`. |
| `apps/web/src/components/shared/cost-defaults.ts`           | Cubre `'notarize'` para que el Record exhaustivo compile.                                                                                                                                          |
| `apps/web/src/components/demo/notarize/DocTypeSelector.tsx` | Radio-cards con 3 tipos de documento.                                                                                                                                                              |
| `apps/web/src/components/demo/notarize/ModeSelector.tsx`    | Radio-cards con `local` / `public` / `both`.                                                                                                                                                       |
| `apps/web/src/components/demo/notarize/PdfDropzone.tsx`     | Drag&drop + click-to-pick para PDF (mime `application/pdf`, máx 10 MB).                                                                                                                            |
| `apps/web/src/components/demo/notarize/AnchorBadges.tsx`    | Sellos generados con chip de estado + link al explorer (solo Polygon).                                                                                                                             |
| `apps/web/src/components/demo/notarize/AnalysisPanel.tsx`   | Dimensiones (tabla), riesgos (chips por severity), recomendaciones (bullets). Vacío si `analysis === null`.                                                                                        |
| `apps/web/src/app/(shell)/demo/notarize/page.tsx`           | Página con wizard (3 steps) + estado idle/submitting/result/error. Reusa `CostMiniWidget` y `AudienceLine`.                                                                                        |
| `apps/web/src/app/styles/ui-kit.css`                        | Bloque CSS `Demo 08 — Notarización` (~560 líneas) con todas las clases `.notarize-*`.                                                                                                              |
| `docs/handoffs/demo-08-notarize-sub-pr-5.md`                | Este documento.                                                                                                                                                                                    |

### Lo que NO toca este sub-PR

- Backend NestJS (sub-PR 4).
- Adapters Local / Polygon (sub-PRs 2 y 3).
- Schema Prisma / migración (sub-PR 1).
- Seed de tenants para habilitar el demo (`enabledDemos`). Queda
  como tarea operativa documentada en el sub-PR 4.

## UX flow

```
/demo/notarize
   │
   ▼
Wizard (status='idle')
   ├─ Step 1: DocTypeSelector  → assembly_minutes | loan | capital_contribution
   ├─ Step 2: PdfDropzone      → File picker / drag&drop, mime pdf, máx 10MB
   ├─ Step 3: ModeSelector     → local | public | both (default 'both')
   └─ Submit (disabled si !file)
        │
        ▼  POST /api/v1/notarize (multipart)
   status='submitting'  → botón loader + selectores disabled
        │
        ├── ok ─→  status='result'  → ResultView
        │           ├─ Header verde con check
        │           ├─ Metadata (hash completo + filename + tamaño + createdAt)
        │           ├─ AnchorBadges (sellos local/polygon con estado + explorer)
        │           └─ AnalysisPanel (dimensiones, riesgos, recomendaciones)
        │
        └── error ─→ status='error' → mensaje inline + botón "intentar de nuevo"

ResultView tiene botón "Notarizar otro documento" → reset() → status='idle'
```

## Endpoints consumidos

| Cliente           | Endpoint                            | Cuándo                                               |
| ----------------- | ----------------------------------- | ---------------------------------------------------- |
| `uploadNotarize`  | `POST /api/v1/notarize` (multipart) | Submit del wizard.                                   |
| `listNotarized`   | `GET /api/v1/notarize`              | (No usado en sub-PR 5, queda exportado para futuro.) |
| `getNotarized`    | `GET /api/v1/notarize/:id`          | (No usado en sub-PR 5.)                              |
| `verifyNotarized` | `GET /api/v1/notarize/:id/verify`   | (No usado en sub-PR 5.)                              |

Los tres últimos quedan listos para iteraciones futuras (página de listado +
verificación post-hoc). El submit es lo único cableado en esta entrega.

## Variables de entorno requeridas en el backend

Para que el demo funcione end-to-end, **el backend** necesita las env vars
descritas en `docs/handoffs/demo-08-notarize-sub-pr-4.md`:

- `NOTARY_MASTER_KEY` (obligatoria si se usa modo `local` o `both`)
- `POLYGON_RPC_URL` (opcional, default `rpc-amoy.polygon.technology`)
- `POLYGON_WALLET_KEY` (obligatoria si se usa modo `public` o `both`)
- `POLYGON_NETWORK` (opcional, default `polygon-amoy`)

Además el tenant del usuario debe tener `notarize` en su `enabledDemos`
(controlado por `@RequireDemo('notarize')` en el controller).

## Cómo verificar el sub-PR

### Sección 1 — Compilación + lint + tests

```bash
npm install        # asegura que no hay drift en package-lock
npm test           # debe pasar (vitest)
npm run lint
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build
```

Esperado:

- Tests: todos verdes (503+ tests pasaron localmente).
- Lint: limpio.
- Typecheck del web: sin errores.
- `next build`: la ruta `/demo/notarize` se lista en el árbol estático.

### Sección 2 — Verificación visual local (opcional)

Requiere el stack arriba (api + web + postgres con tenant que tenga
`notarize` habilitado + `NOTARY_MASTER_KEY` en `.env`):

1. `npm run demo:start` (levanta API + Web).
2. Login con un usuario de tenant que tenga `notarize` habilitado.
3. Ir a `/demo/notarize`.
4. Seleccionar tipo, subir un PDF, modo `local` (no requiere wallet
   Polygon), click `Notarizar y analizar`.
5. Esperar 2–5 segundos. Ver el sello interno + el análisis IA.

Si el tenant **no** tiene `notarize` habilitado, la página carga pero el
submit devuelve 403 y aparece el panel de error con el mensaje del backend.

### Sección 3 — Estructura visual esperada

Para PDFs reales:

- **Header**: eyebrow "Demo 08 · Notarización" + título + subtitle.
- **Cost mini widget** arriba a la derecha (igual que en los otros demos).
- **3 steps** numerados con las 3 cards radio (DocType / Dropzone / Mode).
- **Botón CTA primario** alineado a la derecha.
- **Resultado**: header verde con check, hash completo en `<code>`, sellos
  (1 o 2 según modo), análisis estructurado.

### Sección 4 — i18n

Verificar que las claves nuevas existen tanto en ES como en EN
(`apps/web/src/lib/i18n/strings.ts`):

```bash
grep -c "'notarize\." apps/web/src/lib/i18n/strings.ts
# Debe ser ≥ 100 (50 ES + 50 EN aprox)
```

## Notas para el revisor

- El SSE no se usa: el backend hace todo el pipeline en un POST único, por
  decisión de simplicidad (el análisis IA es <3s con tool calling de un solo
  turn).
- La página queda lista para sumar 2 features en iteraciones futuras: (1)
  listado de documentos previos del tenant; (2) re-verificación de un
  documento ya notarizado (re-chequeo on-chain).
- La validación de mime + tamaño del PDF se hace **del lado cliente** en
  el dropzone (`application/pdf`, máx 10 MB) y se asume que el backend hace
  validación equivalente con `ParseFilePipe`. Si el backend devuelve 400
  por tamaño, el mensaje se muestra inline.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
