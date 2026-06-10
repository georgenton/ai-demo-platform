# Handoff Codex — Demo 08 sub-PR 1 (Notarización · Schema + scaffolding)

> **Cómo usar este documento.** Léelo y verifica las secciones
> reproducibles. Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Primer sub-PR del tren "Demo 08: Notarización cooperativa con IA"
(ADR-0019). **Solo schema + scaffolding del adapter**, sin lógica de
negocio. Los providers reales llegan en sub-PRs 2 (Local) y 3 (Polygon).

### Archivos tocados

| Archivo                                                                               | Cambio                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/0019-demo-08-notarization.md`                                               | ADR nuevo (estado: Propuesto). Lite + Polygon + 3 tipos de doc. Justificación de descarte de Fabric.                                                           |
| `docs/adr/README.md`                                                                  | Entradas para ADR-0018 y ADR-0019.                                                                                                                             |
| `packages/db/prisma/schema.prisma`                                                    | Tablas `NotarizedDocument`, `LocalAnchor`, `PublicAnchor`, `TenantNotaryKey`. Enums `NotarizedDocType`, `PublicAnchorStatus`. Relaciones inversas en `Tenant`. |
| `packages/db/prisma/migrations/20260609180000_add_demo_08_notarization/migration.sql` | Migración SQL manual con CREATE TABLE + indices + FKs + enums. Solo añade, no modifica tablas existentes.                                                      |
| `packages/notary-adapter/package.json`                                                | Package nuevo `@org/notary-adapter`. Cero deps de runtime en sub-PR 1.                                                                                         |
| `packages/notary-adapter/tsconfig.json` + `tsconfig.lib.json`                         | Espejo del `@org/llm-adapter`.                                                                                                                                 |
| `packages/notary-adapter/src/index.ts`                                                | Exports públicos: tipos + factory + 3 providers.                                                                                                               |
| `packages/notary-adapter/src/lib/types.ts`                                            | `NotaryAdapter`, `AnchorRequest`, `AnchorResult`, `VerificationResult`, `NotaryProvider`.                                                                      |
| `packages/notary-adapter/src/lib/notary.ts`                                           | `createNotaryAdapter(provider, deps)`, `notaryFor(provider, deps)` con cache, `isValidNotaryProvider`, `resetNotaryCache`.                                     |
| `packages/notary-adapter/src/lib/providers/local-notary.ts`                           | **Stub** — anchor/verify lanzan "no implementado en sub-PR 1". Recibe deps `{ db, masterKey }` para que el factory pueda instanciarlo.                         |
| `packages/notary-adapter/src/lib/providers/polygon-notary.ts`                         | **Stub** — anchor/verify lanzan "no implementado en sub-PR 1". Recibe deps `{ signer, network }`.                                                              |
| `packages/notary-adapter/src/lib/providers/fake-notary.ts`                            | **Implementación completa** — determinística, sin red, sin keys. Anchor hash derivado vía SHA-256 sobre tenant+doc+contentHash.                                |
| `packages/notary-adapter/src/lib/providers/fake-notary.test.ts`                       | 11 tests del Fake: determinismo, validación de inputs, aislamiento multi-tenant, golden path de anchor/verify.                                                 |
| `packages/notary-adapter/src/lib/notary.test.ts`                                      | 12 tests del factory + cache + stubs.                                                                                                                          |
| `tsconfig.json` (raíz)                                                                | Suma `packages/notary-adapter` a `references` para que `tsc -b` lo incluya.                                                                                    |
| `docs/handoffs/demo-08-notarize-sub-pr-1.md`                                          | Este documento.                                                                                                                                                |

### Lo que NO toca este sub-PR

- `apps/api` / `apps/web` — sin cambios.
- Lógica real de notarización — viene en sub-PRs 2 y 3.
- Endpoints / módulo NestJS — viene en sub-PR 4.
- Frontend `/demo/notarize` — viene en sub-PR 5.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + tests

```bash
cd ~/Projects_local/ai-demo-platform
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx tsc -p packages/notary-adapter/tsconfig.lib.json
npm test                                       # esperado: 444/444 verde (sub-PR 0 tenía 421; +23 nuevos)
npm run lint                                   # esperado: sin output
npx tsc -p apps/api/tsconfig.app.json --noEmit # esperado: sin output (apps/api no usa todavía el package)
```

### Sección 2 — Inspección del schema

Verificar en `packages/db/prisma/schema.prisma`:

1. `Tenant` tiene relaciones inversas: `notarizedDocs`, `localAnchors`, `publicAnchors`, `notaryKey`.
2. `NotarizedDocument` tiene `tenantId`, `docType` (enum), `contentHash`, `analysis` (Json?).
3. `LocalAnchor` tiene `sequence`, `prevAnchorHash`, `anchorHash`, `signature`, `signerKeyId`, `@@unique([tenantId, sequence])`.
4. `PublicAnchor` tiene `network`, `txHash`, `blockNumber` (BigInt), `status` (enum), `anchoredHash`.
5. `TenantNotaryKey` tiene `algorithm`, `publicKeyPem`, `privateKeyEncrypted`, `fingerprint`, `activatedAt`, `deactivatedAt`.
6. Enums: `NotarizedDocType` con 3 valores; `PublicAnchorStatus` con 3 valores.

### Sección 3 — Inspección del adapter

`packages/notary-adapter/src/lib/`:

1. `types.ts` define `NotaryAdapter` con dos métodos: `anchor`, `verify`.
2. `notary.ts` exporta `createNotaryAdapter`, `notaryFor`, `isValidNotaryProvider`, `resetNotaryCache`.
3. Local + Polygon son stubs que lanzan con mensaje que referencia el sub-PR siguiente (2 y 3 respectivamente).
4. Fake está implementado completo: anchor determinístico + verify con shape check.

### Sección 4 — Migración SQL

Migración local-only test (no aplicar contra Railway todavía):

```bash
# Verifica que el SQL es sintácticamente válido y no destruye data.
# Si tienes una Postgres local con el schema viejo aplicado:
DATABASE_URL=postgresql://localhost/test \
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
# Esperado: "All migrations have been successfully applied".

# Verificar que las 4 tablas + 2 enums quedaron creadas:
psql $DATABASE_URL -c "\dt \"NotarizedDocument\" \"LocalAnchor\" \"PublicAnchor\" \"TenantNotaryKey\""
psql $DATABASE_URL -c "\dT \"NotarizedDocType\" \"PublicAnchorStatus\""
```

No aplicar en Railway hasta sub-PR 4 — el módulo NestJS de notarización
debe estar listo para usar las tablas. La migración es 100% aditiva,
así que cuando se aplique en Railway no rompe nada existente.

### Sección 5 — Estructura del package

```bash
tree packages/notary-adapter -L 4 -I node_modules
```

Esperado:

```
packages/notary-adapter
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
└── src
    ├── index.ts
    └── lib
        ├── notary.ts
        ├── notary.test.ts
        ├── providers
        │   ├── fake-notary.ts
        │   ├── fake-notary.test.ts
        │   ├── local-notary.ts
        │   └── polygon-notary.ts
        └── types.ts
```

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `prisma generate` salida (última línea).
- `tsc notary-adapter` salida.
- `npm test` salida (resumen).
- `npm run lint` salida.
- `tsc apps/api` salida.

### Sección B — Schema

- Las 4 tablas y 2 enums están declarados con los campos esperados.
- Tenant tiene las 4 relaciones inversas nuevas.

### Sección C — Migración

- El SQL crea las tablas en el orden correcto (NotarizedDocument antes
  que LocalAnchor/PublicAnchor por las FK).
- No hay DROP ni ALTER de tablas existentes — la migración es 100%
  aditiva.

### Sección D — Adapter package

- `createNotaryAdapter('local')` sin deps lanza con mensaje `/deps\.local/`.
- `createNotaryAdapter('polygon')` sin deps lanza con mensaje `/deps\.polygon/`.
- `notaryFor('fake')` dos veces seguidas devuelve la misma instancia.
- `FakeNotaryAdapter.anchor` es determinístico (mismos inputs → mismo
  anchorId).
- `LocalNotaryAdapter.anchor` y `.verify` lanzan referenciando "sub-PR 2".
- `PolygonNotaryAdapter.anchor` y `.verify` lanzan referenciando "sub-PR 3".

### Sección E — ADR-0019

- Existe en `docs/adr/`.
- Estado: Propuesto.
- Listado en `docs/adr/README.md`.

### Sección F — Riesgos detectados (si hay alguno)

Cualquier cosa que falte en el scaffolding o que se note manualmente al
leer el código (e.g. cómo manejar deduplicación de contentHash, race
conditions en sequence del ledger, edge cases del FakeNotaryAdapter).

---

**Nota para Jorge:** este sub-PR queda listo para mergear en cualquier
momento sin afectar nada de la app actual. Las nuevas tablas viven
desconectadas hasta que el sub-PR 4 las use.
