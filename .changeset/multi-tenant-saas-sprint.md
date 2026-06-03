---
'@org/api': minor
'@org/web': minor
'@org/db': minor
---

Sprint multi-tenant SaaS (PRs #60–#65). La plataforma pasa de basic
auth compartida a una arquitectura SaaS multi-tenant con:

- Auth por usuario (email + password + JWT en cookie httpOnly, ADR-0014).
- Aislamiento de datos por tenant (`tenantId` en `Document` y
  `AgentQuery`, ADR-0013).
- Demos por industria con override por tenant (`enabledDemos` con
  regla de herencia industry → tenant).
- Cadena de guards globales: `InternalKey → Auth → Tenant →
DemoAccess → Roles`.
- Frontend con `AuthProvider`, middleware de redirect a `/login`,
  dashboard real con cards de demos del tenant, sidebar con branding
  custom (logoUrl, accentColor, displayName).
- Admin panel funcional en `/admin/tenant` (PATCH /api/v1/admin/tenant
  con merge no destructivo del branding).
- Tests: +96 nuevos (de 234 a 330 passing), incluyendo
  `tenant-isolation.test.ts`, `industry.service.test.ts`,
  `demo-access.guard.test.ts`, `roles.guard.test.ts`,
  `admin.service.test.ts` y los del cliente HTTP del frontend.

Notas de implementación detalladas en
[ADR-0015](../docs/adr/0015-multi-tenant-implementation-notes.md).
Verificación end-to-end en
[runbook-new-tenant.md](../docs/runbook-new-tenant.md), Paso 4b.

**Backward compatible** vía el tenant interno `demo` creado por el
seed `seed-tenants.ts` — los demos existentes siguen funcionando para
deploys que no creen tenants adicionales todavía.
