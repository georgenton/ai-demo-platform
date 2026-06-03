# Changelog

Cambios notables del proyecto. Cada sprint tiene su propia sección con
fecha. Los detalles fino-granos viven en `.changeset/` (auto-generados
por la herramienta) y los commits siguen Conventional Commits.

## Sprint multi-tenant — 2026-06 (PRs #60–#65)

### Resumen ejecutivo

La plataforma pasa de **una sola instancia con basic auth compartida** a
una **arquitectura SaaS multi-tenant** con auth por usuario, aislamiento
de datos por tenant, demos por industria, branding personalizable y
admin panel funcional. Diseño congelado en
[ADR-0013](./docs/adr/0013-multi-tenant-saas-architecture.md) y
[ADR-0014](./docs/adr/0014-auth-email-password-jwt.md); notas de
implementación en
[ADR-0015](./docs/adr/0015-multi-tenant-implementation-notes.md).

### PR-MT1 — Auth foundation (#60)

- **Schemas**: `Industry`, `Tenant`, `User` con relación FK + enum
  `UserRole` (member/admin/superadmin) y `TenantStatus`.
- **AuthService** + **AuthController**: `POST /auth/login`,
  `POST /auth/logout`, `GET /auth/me`. JWT firmado HS256 con
  `JWT_SECRET` (validado en boot via env-schema), cookie httpOnly +
  SameSite=Strict.
- **bcrypt cost 12** para hash de passwords. **cookie-parser** registrado
  en `main.ts`.
- **Seed inicial**: `seed-tenants.ts` con 6 industries, tenant interno
  `demo` y superadmin `admin@nai.local`.

### PR-MT2 — Tenant scoping en backend (#61)

- Migración en 3 pasos: `Document.tenantId` y `AgentQuery.tenantId`
  como NOT NULL con FK + índices, backfill al tenant `demo`.
- **`AuthGuard`** y **`TenantGuard`** globales registrados en
  `main.ts`. `AuthGuard` con default-deny + `@Public()` opt-out;
  `TenantGuard` inyecta `req.tenantId` desde el JWT.
- **`@CurrentUser()`** y **`@CurrentTenant()`** decorators para los
  handlers.
- **Todos los services** (ingest, chat, compare, agent, corpus,
  documents) reciben `tenantId` y lo aplican en `where` / `$queryRaw`.
- **VectorStore.searchTopK** acepta `tenantId` y hace JOIN a Document
  para filtrar.
- **Tests nuevos**: `tenant-isolation.test.ts` (10 casos: A no puede
  leer/listar/borrar nada de B) + ajustes en suites existentes.

### PR-MT3 — Industry config + demos por industria (#62)

- **`IndustryService.resolveEnabledDemos(tenantId)`**: fuente única de
  verdad de la herencia `tenant.enabledDemos || industry.enabledDemos`.
- **`GET /api/v1/me/demos`**: cartelera final resuelta para el frontend.
- **`DemoAccessGuard`** global + **`@RequireDemo()`** decorator
  (estático o dinámico). Aplicado a chat, compare, agent, corpus,
  tutor, ingest.
- **`DemosController`** filtra catálogo por `enabledDemos`; 404 para
  demos no habilitados (no 403 — evita info leak).
- Tests: `industry.service.test.ts` (10 casos) + `demo-access.guard.test.ts`
  (7 casos).

### PR-MT4 — Frontend auth (#63)

- **`AuthProvider`** + **`useAuth()`** hook con estados
  loading/authenticated/unauthenticated/error.
- **Cliente HTTP** `api/auth.ts`: `login`, `logout`, `getMe`,
  `getMyDemos`.
- **Middleware de Next.js** extendido: además del basic auth, redirige
  a `/login?from=<ruta>` cuando no hay cookie `auth`.
- **`/login` stub funcional**: form mínimo con tokens del ui-kit + i18n
  (ES + EN). El polishing visual queda para Claude Design.

### PR-MT5 — Dashboard custom + branding + admin panel (#64)

- **`@RequireRole()`** + **`RolesGuard`** con jerarquía
  superadmin > admin > member. Defensa en profundidad para
  `/admin/tenant`.
- **`AdminController`** con `PATCH /api/v1/admin/tenant`. Valida
  enabledDemos contra el catálogo (BadRequest si IDs falsos); mergea
  branding no destructivo.
- **`/` (dashboard)** real: de redirect a `/demo/rag` → cards de demos
  habilitados con welcome y subtitle dinámicos.
- **Sidebar con branding del tenant**: displayName, logoUrl y
  accentColor (inyectado como CSS var inline solo en `<aside>`).
- **`/admin/tenant` stub funcional**: form para editar todo el
  branding + checkboxes de enabledDemos.
- Tests: `roles.guard.test.ts` (6 casos) + `admin.service.test.ts`
  (5 casos) + `api/admin.test.ts` (3 casos).

### PR-MT6 — Docs + runbook + glossary (#65) ← este PR

- **ADR-0015**: notas de implementación del sprint (decisiones que
  surgieron al codear, no documentadas en 0013/0014).
- ADR-0013 y ADR-0014 pasan de "Propuesto" a "Aceptado".
- **`runbook-new-tenant.md`**: nueva sección "Paso 4b — Smoke test
  end-to-end" con 6 verificaciones del flujo UX antes de entregar
  accesos.
- **`runbook-local.md`**: nueva sección "6.5 — Troubleshooting de
  autenticación" con 5 síntomas típicos y diagnóstico paso a paso.
- **`glossary.md`**: nueva sección "Multi-tenant SaaS" con 9 términos
  (Tenant, Industry, enabledDemos, branding, soft tenancy,
  TenantGuard, DemoAccessGuard, RolesGuard, JWT en cookie httpOnly,
  migración 3 pasos).
- **`CHANGELOG.md`** (este archivo) creado.

### Métricas del sprint

- 6 PRs, 5 ADRs nuevos o referenciados, 1 migración prisma,
  1 endpoint nuevo (`PATCH /admin/tenant`), 4 endpoints anotados con
  `@RequireDemo`.
- Tests: de 234 (pre-sprint) a **330 passing** (+96 tests).
- Sin breaking changes para los demos existentes — backward compatible
  vía el tenant `demo` por default.

### Cómo verificar después de mergear todo

Ver [`docs/runbook-new-tenant.md`](./docs/runbook-new-tenant.md), sección
"Paso 4b — Smoke test end-to-end".

## Sprints anteriores

Detalles fino-granos en
[`.changeset/`](./.changeset/) y commits siguiendo Conventional Commits.

- **Demo 05** — Tutor de inglés con cost calculator
  ([ADR-0012](./docs/adr/0012-demo-05-english-tutor.md)).
- **Demo 03** — Corpus académico
  ([ADR-0011](./docs/adr/0011-demo-03-waits-for-python.md)).
- **Demo 04** — Agente NL→SQL.
- **Demo 02** — Comparador de documentos.
- **Demo 01** — Chat RAG sobre documentos.
- **Foundation** — Nx monorepo, NestJS, Next.js, Prisma, pgvector,
  LLMAdapter, ui-kit.
