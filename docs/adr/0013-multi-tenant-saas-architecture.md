# ADR-0013 — Multi-tenant SaaS architecture

- **Estado:** Propuesto · pendiente de aprobación de Jorge para entrar al sprint
- **Fecha:** 2026-05-29
- **Decisores:** Jorge, con input de Edguitar para validación comercial
- **Relacionado:**
  - [`ADR-0004`](./0004-llm-adapter-pattern.md) — el LLMAdapter ya abstrae el proveedor; multi-tenant suma el aislamiento de datos
  - [`ADR-0005`](./0005-pgvector-over-dedicated-vector-db.md) — pgvector en la misma DB; multi-tenant agrega filtrado por `tenantId`
  - [`ADR-0014`](./0014-auth-email-password-jwt.md) — la estrategia de auth que habilita esto
  - Slide 47–51 del [`nai-deck.pptx`](../nai-deck.pptx) — sección 6 del deck comercial

## Contexto

Después de la presentación al primer cliente (mayo 2026) la plataforma
demostró traction comercial. El paso natural es ofrecer el producto
como **servicio SaaS multi-tenant** — un único deploy que sirve a
varios clientes (universidades, bancos, estudios profesionales, etc.)
con sus datos aislados.

Hoy la app es de **un solo tenant implícito**: cualquier persona con
acceso al basic auth ve todos los documentos, todos los demos, todo el
audit log. Eso funciona para un cliente que tiene su propio deploy;
no funciona para 10 clientes compartiendo infraestructura.

El cambio toca **todos los módulos del backend** (RAG, Comparator,
Corpus, Agent, Tutor), el **schema de la DB** y el **layout del
frontend**. Por la magnitud, este ADR lo congela antes de codear.

## Decisión

Adoptamos **multi-tenancy "soft"** — una sola DB, una sola instancia
de la app, con una columna `tenantId` en cada tabla que escribe datos
del cliente. Todas las queries filtran por ese `tenantId`.

**Cuatro piezas conceptuales:**

1. **Industry** (vertical de mercado) — tabla pequeña, ~6 filas
   (universidad, banca, legal, salud, gobierno, retail). Define los
   **defaults** de una industria: qué demos están habilitados, qué
   prompts especializados se usan, qué documentos seed se ofrecen.
2. **Tenant** (cliente concreto) — la unidad de aislamiento. "UTPL",
   "Banco Pichincha", "Estudio Andrade". Cada Tenant pertenece a una
   Industry y hereda sus defaults; puede sobreescribir branding y
   configuración de demos.
3. **User** (persona física) — pertenece a un Tenant con un rol
   (`superadmin`, `admin`, `member`). Un user solo ve datos de su
   tenant. El `superadmin` (Jorge + Edguitar) ve todo.
4. **TenantScopedEntity** — patrón aplicado a Document, Chunk,
   DocumentTopic, AgentQuery y cualquier otra entidad que guarde datos
   del cliente. Todas llevan `tenantId` con FK + índice.

**Aislamiento por código, no por DB.** El riesgo principal de soft
tenancy es que un bug se cuele en una query y devuelva datos de otro
tenant. Lo mitigamos con:

- Un **`TenantGuard`** global que extrae el `tenantId` del JWT y lo
  inyecta en cada request via `request.tenantId`.
- Todos los services obtienen el `tenantId` por dependencia
  (parámetro de método o context), **no lo asumen**.
- Tests que verifican explícitamente "user de tenant A no puede ver
  data de tenant B".
- Code review checklist: cada query nueva debe demostrar dónde aplica
  el filtro de tenant.

**Cuándo evoluciona a hard multi-tenancy.** Cuando un cliente
particular tenga compliance estricto que exija aislamiento físico
(banca regulada por SEPS, salud bajo LOPD), se migra ESE tenant a una
DB dedicada manteniendo la app igual. Es un cambio incremental, no
una refactorización.

## Alternativas consideradas

### A — Hard multi-tenancy desde el día uno (schema por tenant)

Cada tenant tiene su propio schema en Postgres. Las queries usan
`SET search_path` o nombres calificados.

- **Pros:** aislamiento natural por el motor de DB, audit simple,
  baja el riesgo de fuga por bug en query.
- **Contras:**
  - Migraciones de Prisma replicadas por tenant — operativamente
    pesado a 10+ tenants.
  - Onboarding de cliente nuevo requiere correr migraciones, no es
    una inserción de fila.
  - El LLMAdapter, el cost engine y casi todo el código no necesita
    saber del schema; sumar awareness del tenant ahí es overhead.
  - PoC todavía está en validación de mercado. Si un cliente abandona,
    sobre-ingeniería pagada en CapEx.
- **Por qué se rechazó:** premia el peor caso (compliance estricto)
  por todos los clientes. Mejor hacer soft + migrar el que lo
  necesite a hard cuando aplique.

### B — Hard multi-tenancy con DB por tenant

Cada tenant tiene una base de datos dedicada. Casi como `A` pero más
caro.

- **Pros:** máxima seguridad, backup independiente, escalabilidad
  vertical por cliente.
- **Contras:** infraestructura crece linealmente con clientes; reset
  de credenciales rota DB completa; multi-region complicado.
- **Por qué se rechazó:** justificado solo para banca regulada o salud
  a gran escala. No es el target del sprint actual.

### C — Subdominio por tenant + apps separadas

`utpl.ai-platform.com` apunta a una instancia distinta de la app.
Cada tenant despliega su propia copia.

- **Pros:** aislamiento total, branding fácil.
- **Contras:** multiplicación de deploys, runbook de operaciones se
  rompe, costos de Vercel/Railway suben proporcional.
- **Por qué se rechazó:** anula el modelo de negocio "compras un NAI
  y vendes slices" — tendrías un NAI por tenant.

### Opción elegida — Soft multi-tenancy

Habilita el modelo de negocio del deck (sección 6), mantiene el costo
operativo bajo, deja la puerta abierta a evolucionar a hard cuando un
cliente concreto lo justifique. Premia el caso típico (PoC, cliente
mediano) sin cerrar la puerta al caso exigente.

## Schema propuesto

Cambios al `schema.prisma`. Tres tablas nuevas, modificaciones en las
existentes.

```prisma
// ---------------------------------------------------------------------------
// Industries — vertical de mercado. Datos relativamente estáticos.
// ---------------------------------------------------------------------------

model Industry {
  id          String   @id @default(cuid())
  slug        String   @unique // 'universidad', 'banca', 'legal', 'salud', 'gobierno', 'retail'
  displayName String
  /// Demos habilitados por default para tenants de esta industria.
  /// Espejo del DemoId union literal del frontend.
  enabledDemos String[] // p.ej. ['rag', 'comparator', 'agent']
  /// JSON con prompts especializados, copy del dashboard, etc.
  defaultConfig Json    @default("{}")
  createdAt   DateTime @default(now())
  tenants     Tenant[]
}

// ---------------------------------------------------------------------------
// Tenants — el cliente concreto. La unidad de aislamiento.
// ---------------------------------------------------------------------------

model Tenant {
  id              String   @id @default(cuid())
  slug            String   @unique // 'utpl', 'banco-pichincha', etc. Usado en URLs y logs.
  displayName     String
  industryId      String
  industry        Industry @relation(fields: [industryId], references: [id])
  /// Sobreescribe enabledDemos de la industry si está presente.
  enabledDemos    String[]
  /// Branding: logo URL, color de acento, copy custom.
  branding        Json     @default("{}")
  /// Estado del tenant. 'active' = operativo, 'trial' = PoC, 'suspended' = pagos vencidos.
  status          TenantStatus @default(trial)
  createdAt       DateTime @default(now())
  users           User[]
  documents       Document[]
  agentQueries    AgentQuery[]

  @@index([industryId])
}

enum TenantStatus {
  active
  trial
  suspended
}

// ---------------------------------------------------------------------------
// Users — usuarios humanos. Pertenecen a UN tenant.
// ---------------------------------------------------------------------------

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   // bcrypt hash
  displayName   String
  role          UserRole @default(member)
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())

  @@index([tenantId])
}

enum UserRole {
  superadmin // Jorge + Edguitar. Ve todos los tenants. NO tiene tenantId vinculante.
  admin      // Gerente del cliente. Invita users de su tenant.
  member     // Usuario regular. Solo consume demos.
}

// ---------------------------------------------------------------------------
// Tablas existentes que reciben tenantId
// ---------------------------------------------------------------------------

model Document {
  id        String   @id @default(cuid())
  // ... campos existentes
  tenantId  String   // NUEVO
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model AgentQuery {
  id        String   @id @default(cuid())
  // ... campos existentes
  tenantId  String   // NUEVO
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt(sort: Desc)])
}
```

**Chunk hereda tenantId vía Document** (relación ya existe). Las
queries pgvector ya filtran por `documentId IN (...)`, así que sumar
`Document.tenantId = ?` en la subquery basta.

**Migración de datos existentes:** un script que crea un tenant
inicial llamado "demo" en la industry "universidad", y actualiza todos
los Document y AgentQuery existentes para apuntar a él. Cero pérdida
de datos.

## Cómo se aísla cada módulo

| Módulo             | Antes                                     | Después                                                                                                      |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Ingest**         | `prisma.document.create({ data: {...} })` | `prisma.document.create({ data: { ..., tenantId } })`                                                        |
| **Chat / RAG**     | Búsqueda en todos los chunks              | `WHERE d.tenantId = ?` en la query pgvector                                                                  |
| **Comparator**     | Carga docs por id                         | Valida que cada id pedido pertenezca al tenant                                                               |
| **Corpus**         | Stats sobre todos los docs                | `WHERE d.tenantId = ?` en stats + papers                                                                     |
| **Agent**          | Run SQL sin restricción                   | El SQL guard ya bloquea writes; sumar filtro automático al WHERE de tablas académicas si el tenant las tiene |
| **Tutor**          | Sin estado persistente                    | Sin cambios (no guarda nada en DB)                                                                           |
| **Documents CRUD** | Lista todos                               | `WHERE tenantId = ?`                                                                                         |

El `TenantGuard` se ejecuta antes que cada controller y deja
`request.tenantId` disponible para los services. Los services lo
toman como parámetro explícito — **nunca leen `request` directo**, eso
acopla service con HTTP.

## Consecuencias

### Positivas

- **Modelo de negocio del deck se vuelve real.** Edguitar puede
  vender suscripciones SaaS sin que cada cliente requiera su propio
  deploy.
- **Onboarding de cliente nuevo en minutos**, no días. Insertar un
  Tenant + 1-2 Users + cargar documentos.
- **Pricing predecible.** El cost engine ya existe; ahora el costo
  está atado al tenant que lo consume, no al deploy entero.
- **Compliance del nivel medio cubierto** (LOPD ecuatoriana, la
  mayoría de cooperativas SEPS). Para nivel alto (banca regulada
  grande, salud nacional), se migra el tenant a hard tenancy
  sin reescribir la app.

### Negativas / costos

- **Cada query que olvide el filtro = riesgo de fuga.** Mitigado con
  TenantGuard + tests + checklist de PR. No eliminado.
- **Frontend más complejo:** sidebar dinámico por demos habilitados,
  branding por tenant, login + protected routes.
- **El test suite crece.** Cada módulo necesita "user A no ve data
  de B" como caso obligatorio.
- **Schema más pesado** — 3 tablas nuevas + columnas en 4 existentes.
  Migración no trivial pero unidireccional.

### Riesgos / cosas a vigilar

- **Bug de aislamiento.** Si un service olvida pasar `tenantId` y
  Prisma devuelve sin filtro, el cliente puede ver data ajena. Tests
  obligatorios por cada endpoint.
- **Performance al crecer:** 10 tenants × 5K docs = 50K chunks. Los
  índices `tenantId` deberían cubrir, pero hay que monitorear el plan
  de ejecución cuando crezca.
- **Costo de embeddings compartido.** Si dos tenants suben documentos
  parecidos, no hay dedup. Es esperable; cada tenant paga sus tokens.
- **Onboarding manual al inicio.** El superadmin crea cada tenant a
  mano. Eventualmente se automatiza con un panel de superadmin (no
  scope inicial).

## Cuándo revisar

- Cuando se sumen 5+ tenants en producción. Verificar performance y
  costo de embeddings.
- Cuando un cliente pida hard tenancy (banca regulada o salud). Migrar
  ESE tenant sin tocar la app.
- Cuando entre Python para procesamiento masivo (ver
  [ADR-0003](./0003-typescript-first-python-later.md)). El servicio
  Python también debe respetar tenantId.

## Referencias

- [ADR-0004](./0004-llm-adapter-pattern.md) — Adapter pattern aplicado
  a LLM. El mismo principio (negocio no toca implementación directa)
  se aplica al `TenantGuard`.
- [ADR-0014](./0014-auth-email-password-jwt.md) — Estrategia de auth
  que habilita este ADR.
- [`runbook-new-tenant.md`](../runbook-new-tenant.md) — Cómo crear un
  cliente nuevo paso a paso (operativo).
- Multi-tenancy patterns: <https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html>
