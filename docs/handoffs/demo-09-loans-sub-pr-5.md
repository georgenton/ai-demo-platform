# Handoff Codex — Demo 09 sub-PR 5 (Cierre del tren · seeds + ADR + runbook)

## Qué cambia este sub-PR

Quinto y último sub-PR del tren ADR-0020. Cierra el Demo 09:

1. **Industria nueva 'cooperativas'** en `seed-tenants.ts` con `enabledDemos: ['rag', 'agent', 'notarize', 'loans']`.
2. **Seed `seed-loans.ts`** — crea tenant `demo-cooperativa` + 8 leads en distintas etapas con sus conversaciones cortas y stage history. Idempotente.
3. **Comandos npm** `db:seed:loans` y `db:seed:loans:railway`.
4. **Demo `loans` pasa a `available`** en `DemoRegistryService` (de `coming-soon`).
5. **Test actualizado**: los 9 demos del roadmap ahora son `available`.
6. **ADR-0020 → Aceptado** + README de ADRs actualizado.
7. **Runbook** `docs/runbook-demo-09-loans.md` con cómo activar, smoke test, golden path, troubleshooting.

### Archivos tocados

| Archivo                                                | Cambio                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `packages/db/prisma/seed-tenants.ts`                   | Suma industria `cooperativas` con 4 demos habilitados.                   |
| `packages/db/prisma/seed-loans.ts`                     | Seed nuevo: tenant `demo-cooperativa` + 8 leads distribuidos por etapas. |
| `package.json`                                         | Comandos `db:seed:loans` y `db:seed:loans:railway`.                      |
| `apps/api/src/app/demos/demo-registry.service.ts`      | `loans.status` pasa de `coming-soon` a `available`.                      |
| `apps/api/src/app/demos/demo-registry.service.test.ts` | Test actualizado: los 9 demos son `available`.                           |
| `docs/adr/0020-demo-09-loan-funnel.md`                 | Estado `Propuesto` → `Aceptado`.                                         |
| `docs/adr/README.md`                                   | Fila de ADR-0020 actualizada a `Aceptado`.                               |
| `docs/runbook-demo-09-loans.md`                        | Runbook operativo nuevo (cómo activar, smoke test, troubleshooting).     |

### Lo que NO entra (deuda registrada en el ADR)

- Bridge a WhatsApp real (sub-PR 6 futuro).
- Adapter real para Cobis/Conexus/Compac (sub-PR 7 futuro).
- Backward transitions de etapa para el oficial.
- Cooldown post-rejected.
- Push SSE para el kanban (hoy es polling 15s).
- Tests end-to-end del LoansService con mock del LLM — la cobertura crítica vive en las 2 funciones puras testeadas (eligibility evaluator + stage validator).

## Los 8 leads sembrados

| Etapa               | Nombre                  | Cédula     | Notas                                        |
| ------------------- | ----------------------- | ---------- | -------------------------------------------- |
| `lead`              | Verónica Caicedo        | —          | Recién contactó, casi sin data.              |
| `lead`              | Roberto Galarza         | —          | Primer mensaje del día.                      |
| `qualification`     | Diego Quiroga           | —          | Confirmó monto+plazo, falta cédula.          |
| `documentation`     | Ana Lucía Tipán         | 0304050607 | Pidiendo rol de pagos.                       |
| `credit_evaluation` | Carlos Yánez Vargas     | 0203040506 | Score 580 borderline, corriendo evaluación.  |
| `approval`          | María Elena Pacheco     | 0102030405 | Aprobada con EligibilityCard verde.          |
| `servicing`         | Mónica Llerena Cevallos | 0506070809 | Préstamo activo, cuotas al día.              |
| `rejected`          | Luis Chimbo Quishpe     | 0405060708 | Rechazo automático por `hasActiveLoan=true`. |

## Cómo verificar

```bash
npm install

# Compila + tests + lint
npm test                # 565 verdes
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build && cd ../..

# Seed end-to-end (local)
npm run db:seed:tenants  # crea la industria cooperativas
npm run db:seed:loans    # crea tenant + 8 leads
npm run db:seed:loans    # corrida 2: debe borrar y recrear (idempotente)
```

Verificar en BD:

```sql
SELECT slug FROM "Industry" WHERE slug='cooperativas';
SELECT slug, "enabledDemos" FROM "Tenant" WHERE slug='demo-cooperativa';
SELECT count(*) FROM "LoanLead" WHERE "tenantId"=(SELECT id FROM "Tenant" WHERE slug='demo-cooperativa');
-- Esperado: count = 8
```

Verificar en HTTP:

```bash
curl http://localhost:3000/api/v1/demos | jq '.demos[] | select(.id=="loans")'
# Esperado: status: "available"
```

## Smoke test manual de la demo en vivo

Ver "Mensajes iniciales recomendados (golden path)" en `docs/runbook-demo-09-loans.md`.

Cédulas mágicas para usar:

- `0102030405` — María Pacheco · aprobación clara.
- `0203040506` — Carlos Yánez · contra-oferta (score borderline).
- `0304050607` — Ana Tipán · socio nuevo sin historial.
- `0405060708` — Luis Chimbo · rechazo automático (préstamo activo).

## Riesgos guardados

- El seed asume que la industria `cooperativas` existe. Si no, lanza error y dice "corre primero db:seed:tenants" (chequeado manualmente — funciona).
- El tenant `demo-cooperativa` se crea con un branding y enabledDemos por defecto. Si ya existe, el seed actualiza esos campos. Cualquier configuración manual previa SE PIERDE en cada corrida — apropiado para un demo tenant, NO para tenants reales.
- 8 leads es suficiente para un kanban "vivo" sin sobrecargar visualmente. Si se quiere más diversidad, ampliar `SEED_LEADS` en el archivo.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
