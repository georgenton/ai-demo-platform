# Runbook — Demo 09 · Funnel de préstamos (ADR-0020)

Cómo activar y operar el **Demo 09 — Funnel de préstamos asistido por IA** para CACs ecuatorianas.

## Resumen del demo

- Vista socio: `/demo/loans` — chat tipo WhatsApp con Coopi (el bot).
- Vista oficial: `/demo/loans/funnel` — kanban con KPIs + drawer de detalle.
- Backend: NestJS `LoansModule` con 5 tools del LLM (`register_lead`, `request_document`, `consult_core_banking`, `calculate_loan_eligibility`, `move_to_stage`).
- Mock del core bancario en `@org/core-banking-adapter` con 4 socios sembrados.

## Prerrequisitos

- Stack arriba (api + web + Postgres). En local: `npm run demo:start`.
- Para producción / Railway: las variables de entorno del LLM ya configuradas (CHAT_PROVIDER + CHAT_API_KEY + CHAT_MODEL). El demo **NO requiere env vars adicionales** — el `MockCoreBankingAdapter` no necesita configuración externa.

## Activación paso a paso

### 1. Aplicar la migración de Prisma

El backend lo hace automáticamente al iniciar:

```bash
# En Railway:
# El comando de start (`prisma migrate deploy && node dist/...`) aplica
# `20260623172738_add_demo_09_loan_funnel` solo. No hay que hacer nada.

# En local:
npm run db:migrate    # si no se aplicó ya
```

### 2. Asegurar la industria 'cooperativas'

El sub-PR 5 sumó `cooperativas` a las industrias semilla. Si tu BD viene de antes:

```bash
# Local:
npm run db:seed:tenants

# Railway:
npm run db:seed:tenants:railway
```

Verifica que existe:

```sql
SELECT slug, "displayName", "enabledDemos" FROM "Industry" WHERE slug='cooperativas';
-- Esperado: enabledDemos = ['rag', 'agent', 'notarize', 'loans']
```

### 3. Sembrar leads de ejemplo

```bash
# Local:
npm run db:seed:loans

# Railway:
npm run db:seed:loans:railway
```

Esto crea:

- Un tenant `demo-cooperativa` con `displayName='Demo · Cooperativa Andina (ficticia)'`.
- 8 leads distribuidos por las 7 etapas activas + 1 rejected.
- Sus conversaciones cortas y stage history.

El seed es **idempotente**: borra los leads previos del tenant antes de recrear (cascada limpia conversations + stage history). Se puede correr cuantas veces necesites sin duplicar.

### 4. (Opcional) Crear un usuario para el tenant de la cooperativa

Si todavía no tienes un user logueable contra `demo-cooperativa`:

```bash
# Prisma Studio es lo más rápido:
DATABASE_URL="<la url de Railway>" npx prisma studio --schema packages/db/prisma/schema.prisma

# Tabla User → crear nuevo con:
#   email: oficial@coop-andina.demo
#   passwordHash: bcrypt de la contraseña que vayas a usar
#   role: 'tenant-admin'
#   tenantId: <id del tenant 'demo-cooperativa'>
```

Para generar el hash bcrypt rápidamente:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuContraseña123', 12))"
```

### 5. Smoke test end-to-end

1. Login con el user del tenant cooperativa.
2. Ir a `/demo/loans/funnel`.
3. Ver el kanban con 8 cards distribuidas en distintas columnas.
4. Click en cualquier card → drawer abre con datos + análisis (si aplica).
5. Ir a `/demo/loans`.
6. Mandar un mensaje cualquiera al bot — debería responder y eventualmente llamar tools.

## Cosas a saber durante una demo en vivo

### Las cédulas mágicas

El `MockCoreBankingAdapter` reconoce 4 socios. Cuando el bot pida cédula, usar:

| Cédula     | Comportamiento esperado                                                 |
| ---------- | ----------------------------------------------------------------------- |
| 0102030405 | María Elena Pacheco · score 780 · aprobación clara.                     |
| 0203040506 | Carlos Yánez · score 580 · borderline, contra-oferta.                   |
| 0304050607 | Ana Tipán · socio nuevo sin historial · score default.                  |
| 0405060708 | Luis Chimbo · score 850 PERO `hasActiveLoan=true` → rechazo automático. |

Cualquier otra cédula de 10 dígitos → "cédula no registrada, sugerir oficina".

### Mensajes iniciales recomendados (golden path)

Para la demo en vivo, ejemplo de prompt al socio:

> "Hola, soy María Elena Pacheco, mi celular es 0991123456, quiero un préstamo de $2000 a 12 meses para refaccionar mi local."

El bot debería:

1. Saludar y pedir confirmación o cédula.
2. Llamar `register_lead`.
3. Pedir cédula.
4. Llamar `consult_core_banking` con 0102030405.
5. Llamar `calculate_loan_eligibility` con score=780, income=$1450, etc.
6. Mostrar EligibilityCard "Elegible".
7. Llamar `move_to_stage` hacia `qualification`, `documentation`, etc según el flujo.

### Caso rechazo (para mostrar el path triste)

> "Soy Luis Chimbo, cédula 0405060708, mi celular 0998123771. Quiero $3000."

El bot llama `consult_core_banking` → ve `hasActiveLoan=true` → llama `calculate_loan_eligibility` → veredicto rechazo → llama `move_to_stage` hacia `rejected`. EligibilityCard rojo.

### Costo aproximado del demo en LLM

- ~8K tokens input + ~2K tokens output por conversación completa (configurado en `cost-defaults.ts`).
- A pricing default ≈ $0.04 por conversación.
- 200 conversaciones/mes ≈ $8/mes para una cooperativa mediana.

## Troubleshooting

### El kanban viene vacío después del seed

```bash
# Verificar que los leads existen:
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"LoanLead\" WHERE \"tenantId\"=(SELECT id FROM \"Tenant\" WHERE slug='demo-cooperativa');"
# Esperado: count = 8

# Verificar que el user logueado pertenece al tenant correcto:
psql "$DATABASE_URL" -c "SELECT u.email, t.slug FROM \"User\" u JOIN \"Tenant\" t ON t.id=u.\"tenantId\" WHERE u.email='oficial@coop-andina.demo';"
```

### Endpoint 403 al mandar mensaje

El tenant no tiene `loans` en su `enabledDemos`. Para arreglarlo:

```bash
# Vía Prisma Studio:
DATABASE_URL="..." npx prisma studio --schema packages/db/prisma/schema.prisma
# Tabla Tenant → agregar 'loans' al array `enabledDemos`.
```

### El bot inventa cédulas

Si el LLM (especialmente modelos chicos en private-mac) inventa cédulas de 10 dígitos para llamar `consult_core_banking`, el adapter devuelve `null` y el bot dice "cédula no registrada". El path queda gracioso pero no rompe el demo.

Para reducir el riesgo, el system prompt de Coopi tiene la regla dura "NUNCA inventes datos". Si quieres reforzar, agrega a `prompts.ts` un ejemplo few-shot.

## Cosas para el siguiente sprint

Documentadas en el ADR-0020 como follow-ups:

- **Sub-PR 6 (futuro)**: bridge a WhatsApp real (Cloud API de Meta + orquestador on-prem).
- **Sub-PR 7 (futuro)**: adapter real para Cobis/Conexus/Compac según el primer cliente firmado.
- **Backward transitions de etapa**: el sub-PR 5 no las permite. Si un oficial necesita "devolver" un lead, hay que ampliar el validador.
- **Cooldown post-rejected**: real-world las CACs permiten re-aplicar tras X días. Hay que sumar `LoanLead.rejectedUntil: DateTime?`.
- **Push SSE para el kanban**: hoy hace polling cada 15s. Reemplazar por un canal SSE que emita `lead_updated` cuando una conversación avanza.

## Referencias

- ADR: [docs/adr/0020-demo-09-loan-funnel.md](./adr/0020-demo-09-loan-funnel.md)
- Handoffs Codex: [docs/handoffs/demo-09-loans-sub-pr-{1,2,3,4,5}.md](./handoffs/)
- Package del adapter: `packages/core-banking-adapter/`
- Backend: `apps/api/src/app/loans/`
- Frontend: `apps/web/src/app/(shell)/demo/loans/` + `apps/web/src/components/demo/loans/`
- Seed: `packages/db/prisma/seed-loans.ts`
