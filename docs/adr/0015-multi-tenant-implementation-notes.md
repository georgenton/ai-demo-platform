# ADR-0015 — Multi-tenant: notas de implementación del sprint MT1..MT5

- **Estado:** Implementado y mergeado (PRs MT1–MT5)
- **Fecha:** 2026-06-01
- **Decisores:** Jorge
- **Relacionado:**
  - [`ADR-0013`](./0013-multi-tenant-saas-architecture.md) — diseño de la
    arquitectura multi-tenant (decisiones de alto nivel)
  - [`ADR-0014`](./0014-auth-email-password-jwt.md) — estrategia de auth
    (email + password + JWT en cookie httpOnly)
  - PR #60 (MT1), PR #61 (MT2), PR #62 (MT3), PR #63 (MT4), PR #64 (MT5)

## Por qué este ADR

ADR-0013 y ADR-0014 fijaron las **decisiones de diseño** del sprint
multi-tenant **antes** de codear. Este ADR documenta las **decisiones de
implementación** que surgieron al traducir esos documentos a código, para
que un dev futuro entienda el porqué de patrones que se repiten en el
codebase sin tener que reconstruirlo desde commits.

No reemplaza a 0013/0014 — los complementa con lo que aprendimos al
implementar.

## Decisiones implementación que vale la pena documentar

### 1. Migración de columnas NOT NULL en 3 pasos

**Contexto:** `Document.tenantId` y `AgentQuery.tenantId` se agregaron
sobre filas existentes. Postgres rechaza `ALTER TABLE ... ADD COLUMN
tenantId TEXT NOT NULL` cuando hay filas — pide un default o tener todo
en NULL.

**Decisión:** patrón de migración en tres pasos dentro de un solo archivo
SQL idempotente (ver
[`packages/db/prisma/migrations/20260601181401_add_tenant_id_to_existing_tables/migration.sql`](../../packages/db/prisma/migrations/20260601181401_add_tenant_id_to_existing_tables/migration.sql)):

1. `ALTER TABLE ... ADD COLUMN tenantId TEXT;` (nullable).
2. `DO $$ ... $$` que crea el tenant `'demo'` si no existe y backfillea
   todas las filas con su id.
3. `ALTER TABLE ... ALTER COLUMN tenantId SET NOT NULL;` +
   `ADD CONSTRAINT fk` + `CREATE INDEX`.

**Trade-off aceptado:** el backfill asume tenant interno `'demo'`. Si en
el futuro tenemos varias DBs de prod con datos preexistentes (Railway +
on-prem cliente), el seed `seed-tenants` debe correr antes que la
migración o el backfill referencia un tenant que no existe. Documentado
en `runbook-deploy.md`.

### 2. Cadena de guards globales en orden estricto

**Contexto:** cada guard depende del trabajo del anterior. Sin orden
fijo, código que parece correcto rompe en runtime (ej. `DemoAccessGuard`
sin `tenantId` → 403 confuso).

**Decisión:** registrados en `main.ts` en orden explícito y comentado:

```
InternalKey → Auth → Tenant → DemoAccess → Roles
```

Cada uno **defensive-checks** que el anterior corrió (ej. RolesGuard
arroja 403 con mensaje claro si `req.user` no está, en lugar de leer
`undefined.role`). Eso convierte "bug de orden" en error temprano,
en lugar de degradación silenciosa.

### 3. Opt-in con decorators, no globales puros

**Contexto:** dos opciones para gating:

- **A**: guards globales que validan **siempre** (default deny). Cada
  endpoint declara opt-out con `@Public()`.
- **B**: guards globales que solo actúan si el handler lleva el decorator
  correspondiente (`@RequireDemo`, `@RequireRole`).

**Decisión:**

- `AuthGuard` usa **modo A** — default deny + `@Public()` opt-out. La
  seguridad por default es el invariante más importante.
- `DemoAccessGuard` y `RolesGuard` usan **modo B** — opt-in con decorator.
  Permite que `MeController` exponga `/me/demos` sin auto-bloquearse, y
  evita consultas innecesarias a la DB en endpoints que no necesitan
  validar demo/rol.

### 4. 404 vs 403 cuando un tenant no tiene un demo

**Contexto:** un user del tenant A pide `GET /api/v1/demos/tutor`
cuando tutor no está en sus `enabledDemos`. Dos opciones:

- **403 con "no habilitado"** — claro, pero confirma que el demo
  `tutor` existe (info leak menor).
- **404 con "demo no existe"** — mismo mensaje que si el ID fuera falso,
  cero info leak.

**Decisión:** 404, igual que cuando un user A pide un Document del
tenant B (PR-MT2). Cero info leak por default; el frontend ya filtra el
catálogo en el cliente y no lo necesita.

### 5. Merge no destructivo de `branding`

**Contexto:** el admin envía `PATCH /admin/tenant { branding: { accentColor: '#FF0' } }`. Si pisamos `branding` entero, perdemos el `logoUrl` y `displayName` que estaban antes.

**Decisión:** `AdminService.updateMyTenant` lee el `branding` actual,
hace shallow merge con el patch y persiste el resultado. Documentado en
el comment del método. El admin panel del frontend igual envía todos
los campos del `branding` en cada save — el merge es defensivo, no
load-bearing, pero ahorra round-trips si alguien hace PATCH parcial
desde un cliente externo.

### 6. `accentColor` como CSS var inline, no global

**Contexto:** un tenant con `accentColor: #FF6600` debe pintar su
sidebar naranja sin que ese color aparezca en el dashboard, header, ni
páginas de demos. Múltiples opciones:

- Reemplazar el `.css` con un build dinámico per-tenant (overkill).
- Inline style en el body con `--color-accent`: contamina toda la app.
- **Inline style solo en `<aside>`**: el accent solo se ve en el
  sidebar, el resto usa el default del ui-kit.

**Decisión:** inline solo en `<aside>` (PR-MT5). Si en el futuro queremos
extender el branding al header y a las cards del dashboard, lo movemos
arriba al `(shell)/layout` — el patrón ya está.

### 7. Tipos espejados manualmente entre backend y frontend

**Contexto:** ADR-0010 declaró "no `@org/contracts`". El sprint
multi-tenant suma 4 archivos de tipos en `apps/web/src/lib/api/`:

- `types-auth.ts` (AuthResponse, MeDemosResponse, LoginRequest, etc.)
- `types-admin.ts` (UpdateTenantRequest, AdminTenantResponse)
- Los anteriores `types-demos.ts` etc.

**Decisión:** mantuvimos la regla de duplicación manual. Coste: una vez
hay que tocar los dos archivos cuando se agrega un campo. Beneficio:
backend y frontend pueden deployarse independientemente, las breaking
changes se detectan en revisión de PR (no en CI compleja), y un dev
nuevo entiende el contrato leyendo un archivo, sin saltar a un package
externo. Cuando la cantidad de tipos crezca lo suficiente para que el
drift sea un problema real, re-evaluamos en un ADR nuevo.

### 8. Stubs visuales con tokens del ui-kit

**Contexto:** Claude Code **no** hace UI fina (CLAUDE.md). PR-MT4 y
PR-MT5 dejaron tres páginas nuevas (`/login`, `/`, `/admin/tenant`)
**funcionalmente completas** pero con UI minimal.

**Decisión:** cada stub usa solo CSS vars del ui-kit (`var(--surface-bg)`,
`var(--text-strong)`, etc.) con fallbacks. Así Claude Design puede:

- Reemplazar el layout sin tocar la lógica.
- Reusar los tokens existentes (consistencia visual con el resto de la
  app).
- Detectar drift de tokens al ver fallbacks que no debería ver
  (`#0c1418` aparece en su DevTools = el token `--surface-bg` no se
  está resolviendo).

Comments al inicio de cada archivo explican qué es **contrato** (no
tocar: hooks, props, i18n keys) y qué queda libre para diseñar.

## Consecuencias

- **Onboarding más rápido**: un dev nuevo lee 0013 (qué) → 0014 (auth) →
  este (cómo) en orden y puede contribuir.
- **Patrones replicables**: el "opt-in guard" se aplica a futuros guards
  (RateLimitGuard, AuditGuard) sin discutir el shape.
- **Migraciones más seguras**: la próxima vez que agreguemos un campo
  NOT NULL a una tabla con datos, el patrón de tres pasos es el default.

## Próximas decisiones que aún no se documentan

(Pendientes para ADRs futuros cuando entren al sprint.)

- **Rotación de JWT_SECRET sin invalidar todas las sesiones.**
- **Audit log filtrado por tenant en la UI del admin** (hoy `AgentQuery`
  tiene tenantId, pero no hay endpoint admin para verlo).
- **Self-service signup** (alta de tenant sin superadmin). Hoy todo el
  alta es manual via runbook.
- **Branding extendido a header + dashboard cards** (hoy solo sidebar).
