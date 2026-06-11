# Handoff Codex — Demo 08 sub-PR 4 (Notarización · Backend NestJS)

> **Cómo usar este documento.** Léelo y verifica las secciones
> reproducibles. Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Cuarto sub-PR del tren ADR-0019. **NotarizeModule en `apps/api`** — el
módulo NestJS que orquesta upload → hash → notarize → análisis IA.

### Stacked sobre sub-PR 3

Esta rama se basa en `feat/demo-08-notarize-pr-3-polygon` (PR #102). Si #102
se mergea antes, GitHub recalcula la base.

### Archivos tocados

| Archivo                                                | Cambio                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/app/notarize/dto/notarize.dto.ts`        | DTOs: `NotarizeUploadBodyDto`, `NotarizeResponseDto`, `VerificationResponseDto`, tipos `NotarizedDocTypeDto`, `NotarizeMode`, `AnchorSummary`, `DocumentAnalysis`.            |
| `apps/api/src/app/notarize/analyzers/index.ts`         | Tool `submit_analysis` (genérico) + 3 system prompts especializados (acta, préstamo, aporte) con contexto SEPS / LOEPS Ecuador.                                               |
| `apps/api/src/app/notarize/analyzers/analyze.ts`       | `analyzeDocument(docType, text, llmProvider?)` que invoca `chat.streamWithTools` y parsea el tool input al shape esperado.                                                    |
| `apps/api/src/app/notarize/analyzers/analyze.test.ts`  | 5 tests: golden path, sin tool call, shape inválido, severity fuera del enum, docType desconocido.                                                                            |
| `apps/api/src/app/notarize/notarize.service.ts`        | `NotarizeService` con `notarize()`, `findById()`, `list()`, `verify()`. Persistencia de `NotarizedDocument` + `PublicAnchor` + análisis.                                      |
| `apps/api/src/app/notarize/notarize.controller.ts`     | 4 endpoints: `POST /notarize` (multipart), `GET /notarize`, `GET /notarize/:id`, `GET /notarize/:id/verify`. `@RequireDemo('notarize')`.                                      |
| `apps/api/src/app/notarize/notarize.module.ts`         | Construye los 2 `NotaryAdapter` con DI tokens `LOCAL_NOTARY` + `POLYGON_NOTARY`. Lee env vars con `ConfigService`. Construye `ethers.Wallet` cuando hay `POLYGON_WALLET_KEY`. |
| `apps/api/src/app/app.module.ts`                       | Importa `NotarizeModule`.                                                                                                                                                     |
| `apps/api/src/app/demos/demo-registry.service.ts`      | Suma `notarize` al catálogo de demos (status='available').                                                                                                                    |
| `apps/api/src/app/demos/demo-registry.service.test.ts` | Updated counts a 8 demos.                                                                                                                                                     |
| `apps/api/src/app/config/env.schema.ts`                | 4 env vars nuevas: `NOTARY_MASTER_KEY` (mín 64 chars hex), `POLYGON_RPC_URL`, `POLYGON_WALLET_KEY`, `POLYGON_NETWORK`. Todas opcionales (server arranca sin demo 08).         |
| `apps/api/package.json`                                | Añade `ethers@^6.13.4` + `@org/notary-adapter@^0.0.1`.                                                                                                                        |
| `package-lock.json`                                    | Regenerado tras `npm install`.                                                                                                                                                |
| `docs/handoffs/demo-08-notarize-sub-pr-4.md`           | Este documento.                                                                                                                                                               |

### Lo que NO toca este sub-PR

- Schema Prisma o migraciones (sub-PR 1).
- Implementación del adapter (sub-PRs 2 y 3).
- Frontend `/demo/notarize` (sub-PR 5).
- Seed para habilitar el demo en industries específicas (queda para
  cuando se sume `cooperativa` o se decida en qué industria habilitarlo).

## Arquitectura del flujo `notarize()`

```
PDF multipart
   │
   ▼
NotarizeController.upload(file, body, tenantId, llmProvider)
   │
   ▼
NotarizeService.notarize(buffer, {name, docType, mode}, tenantId, llmProvider)
   │
   ├─ 1. contentHash = SHA-256(buffer)
   │
   ├─ 2. text = PdfTextExtractor.extractText(buffer)
   │   └─ Si vacío → 400 "PDF sin texto"
   │
   ├─ 3. prisma.notarizedDocument.create({ tenantId, name, docType, content, contentHash, contentSize })
   │
   ├─ 4. Promise.allSettled([
   │       (mode in [local, both]) → runLocalAnchor(...)   → LocalNotaryAdapter.anchor(...)
   │                                                          + LocalAnchor INSERT por el adapter
   │       (mode in [public, both]) → runPublicAnchor(...) → PolygonNotaryAdapter.anchor(...)
   │                                                          + prisma.publicAnchor.create(...)
   │     ])
   │   └─ Cualquier fallo → AnchorSummary { status: 'failed', errorMessage }
   │      no aborta el otro.
   │
   ├─ 5. analyzeDocument(docType, text, llmProvider)
   │   ├─ chat.streamWithTools([{system}, {user}], [SUBMIT_ANALYSIS_TOOL], { provider })
   │   ├─ Captura tool_use_complete event
   │   └─ Parsea + valida shape
   │
   ├─ 6. prisma.notarizedDocument.update({ analysis })
   │
   ▼
NotarizeResponseDto { documentId, contentHash, analysis, anchors[] }
```

## Endpoints

| Method | Path                          | Descripción                                                        |
| ------ | ----------------------------- | ------------------------------------------------------------------ |
| POST   | `/api/v1/notarize`            | multipart con `file` + `docType` + `mode?`. Devuelve doc completo. |
| GET    | `/api/v1/notarize`            | Lista de los 50 docs más recientes del tenant.                     |
| GET    | `/api/v1/notarize/:id`        | Detalle (incluye anchors + análisis).                              |
| GET    | `/api/v1/notarize/:id/verify` | Re-verifica anchors contra providers.                              |

Todos gated por `@RequireDemo('notarize')` — el tenant debe tener el demo
habilitado.

## Env vars nuevas

| Var                  | Obligatoria         | Default                               | Validación                               |
| -------------------- | ------------------- | ------------------------------------- | ---------------------------------------- |
| `NOTARY_MASTER_KEY`  | Si quieres `local`  | —                                     | Hex de 64 chars (32 bytes para AES-256). |
| `POLYGON_RPC_URL`    | No                  | `https://rpc-amoy.polygon.technology` | String                                   |
| `POLYGON_WALLET_KEY` | Si quieres `public` | —                                     | String (private key)                     |
| `POLYGON_NETWORK`    | No                  | `polygon-amoy`                        | String                                   |

Generar la master key:

```bash
openssl rand -hex 32
```

Wallet de demo: crear con MetaMask y pedir POL del faucet Amoy
(https://faucet.polygon.technology). Cada anchor cuesta ~24400 gas.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + tests

```bash
cd ~/Projects_local/ai-demo-platform
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx tsc -p apps/api/tsconfig.app.json --noEmit
npm test                # esperado: 503/503 verde (sub-PR 3 tenía 498; +5 nuevos)
npm run lint            # esperado: sin output
```

### Sección 2 — Inspección de los analyzers

`apps/api/src/app/notarize/analyzers/`:

1. `index.ts` define `SUBMIT_ANALYSIS_TOOL` (tool genérico) + `ANALYZER_PROMPTS`
   con 3 entradas (`assembly_minutes`, `loan`, `capital_contribution`).
2. Cada prompt menciona contexto Ecuador (LOEPS, SEPS) y enumera las
   dimensiones esperadas con sus `key` slugs.
3. `analyze.ts` exporta `analyzeDocument(docType, text, llmProvider)`.
4. Trunca el texto a 12k chars antes de mandarlo al LLM.

### Sección 3 — Inspección del NotarizeService

`apps/api/src/app/notarize/notarize.service.ts`:

1. Tokens DI `LOCAL_NOTARY` + `POLYGON_NOTARY` exportados (los usa el
   module).
2. `notarize()` ejecuta el pipeline en orden: hash → extract → create →
   notaries (allSettled) → analyze → update.
3. `runLocalAnchor()` y `runPublicAnchor()` convierten errores en
   `AnchorSummary { status: 'failed', errorMessage }` sin propagar
   excepciones (un anchor roto no debe abortar el otro).
4. `runPublicAnchor()` persiste PublicAnchor incluso en falla
   (para auditoría / reintentos).
5. `findById()` y `list()` filtran por `tenantId` (multi-tenant).
6. `verify()` re-llama al `verify()` de cada adapter.

### Sección 4 — Inspección del NotarizeModule

`notarize.module.ts`:

1. Provider `LOCAL_NOTARY` lee `NOTARY_MASTER_KEY` del config. Si no
   está → lanza al boot con mensaje claro.
2. Provider `POLYGON_NOTARY` lee `POLYGON_*`. Si `POLYGON_WALLET_KEY` no
   está → registra un signer "broken" que lanza al usar (el server
   arranca igual; solo el modo `public` / `both` falla).
3. Si está → construye `ethers.JsonRpcProvider` + `ethers.Wallet`.

### Sección 5 — Smoke test local (con backend corriendo)

Asumiendo el server up en `localhost:3000` con env mínimo:

- `CHAT_PROVIDER=fake` + `EMBEDDINGS_PROVIDER=fake` (de sub-PR 4 de embeddings).
- `NOTARY_MASTER_KEY=$(openssl rand -hex 32)`
- `POLYGON_WALLET_KEY=` (vacío — modo 'local' funcionará, 'public' fallará)
- Tenant existente con `notarize` en `enabledDemos`.

```bash
# Login
curl -c /tmp/c.jar -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@nai.local","password":"demo-platform-2026"}'

# Upload + notarizar (modo local) — usa cualquier PDF de prueba
curl -b /tmp/c.jar -X POST http://localhost:3000/api/v1/notarize \
  -F "file=@/tmp/test.pdf" \
  -F "docType=assembly_minutes" \
  -F "mode=local"
# Esperado: 201 con documentId + 1 anchor local 'confirmed'.
# Si CHAT_PROVIDER=fake, el análisis IA será vacío (el fake no llama tools).
```

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `prisma generate` salida.
- `tsc apps/api` salida.
- `npm test` salida (resumen, # tests).
- `npm run lint` salida.

### Sección B — Estructura del módulo

- 4 archivos en `apps/api/src/app/notarize/` (controller, service, module,
  dto/notarize.dto).
- 3 archivos en `apps/api/src/app/notarize/analyzers/` (index, analyze,
  analyze.test).
- `NotarizeModule` importado en `AppModule`.
- `notarize` aparece en `demo-registry.service.ts` y matchea con el test.

### Sección C — Env schema

- Las 4 vars nuevas existen en `EnvSchema` y son opcionales.
- `NOTARY_MASTER_KEY` tiene `@MinLength(64)`.

### Sección D — package.json

- `ethers@^6.13.4` está en `apps/api/package.json:dependencies`.
- `@org/notary-adapter` está en `apps/api/package.json:dependencies`.
- `package-lock.json` está actualizado (sin diff vs lo commiteado).

### Sección E — Riesgos detectados (si hay alguno)

Cualquier cosa que se note manualmente:

- Tipos de Prisma vs structural `LocalNotaryDb` — verificar si el cast
  `as unknown as LocalNotaryDb` puede esconder mismatches.
- Manejo de `analysis: Json` — JSON.parse vs cast directo.
- Race conditions en `runPublicAnchor` (insert antes vs después del tx).
- Tenant resolution en upload — `@CurrentTenant()` puede devolver
  undefined; el controller lo chequea.

---

**Nota para Jorge:** este sub-PR es operativo end-to-end con `mode='local'`
una vez seteás `NOTARY_MASTER_KEY` en Railway. Para `mode='public'` /
`mode='both'` también necesitás `POLYGON_WALLET_KEY` con saldo en Amoy.
El sub-PR 5 conecta esto al frontend `/demo/notarize`.
