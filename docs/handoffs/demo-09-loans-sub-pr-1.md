# Handoff Codex — Demo 09 sub-PR 1 (Funnel de préstamos · Schema + Adapter scaffolding)

> **Cómo usar este documento.** Léelo entero y verifica las secciones reproducibles.
> Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Primer sub-PR del tren ADR-0020 (Demo 09 — Funnel de préstamos asistido por IA para CACs ecuatorianas). Entrega la base sobre la que crecerán los próximos 4:

1. **ADR-0020** con la decisión de modelado (7 etapas del funnel + 5 tools del LLM + adapter pattern para core bancario).
2. **Schema Prisma** con 3 modelos nuevos (`LoanLead`, `LoanConversation`, `LoanStageHistory`) y 1 enum (`LoanStage`).
3. **Migración** `20260623172738_add_demo_09_loan_funnel` — 100% aditiva.
4. **Package `@org/core-banking-adapter`** con la interfaz `CoreBankingAdapter`, factory `coreBankingFor()` y `MockCoreBankingAdapter` totalmente implementado con 4 socios sembrados.
5. **Registro del demo** en `DemoRegistryService` con status `coming-soon` (pasa a `available` en sub-PR 5).

### Archivos tocados

| Archivo                                                                              | Cambio                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/0020-demo-09-loan-funnel.md`                                               | ADR completo en estado `Propuesto`.                                                                                                                                                                      |
| `docs/adr/README.md`                                                                 | Fila para ADR-0020.                                                                                                                                                                                      |
| `packages/db/prisma/schema.prisma`                                                   | +1 relación en `Tenant`, +3 modelos, +1 enum. Sin tocar nada existente.                                                                                                                                  |
| `packages/db/prisma/migrations/20260623172738_add_demo_09_loan_funnel/migration.sql` | Migración aditiva (CREATE TYPE + 3 CREATE TABLE + índices + FKs).                                                                                                                                        |
| `packages/core-banking-adapter/`                                                     | Package nuevo (package.json, tsconfig.lib.json, tsconfig.json, src/index.ts, src/lib/types.ts, src/lib/providers/mock-core-banking.ts, src/lib/providers/adapter-factory.ts, mock-core-banking.test.ts). |
| `apps/api/package.json`                                                              | Suma `@org/core-banking-adapter` como dependency.                                                                                                                                                        |
| `apps/api/tsconfig.app.json`                                                         | Suma reference al `tsconfig.lib.json` del nuevo package.                                                                                                                                                 |
| `apps/api/src/app/demos/demo-registry.service.ts`                                    | Entrada `loans` con `status: 'coming-soon'`.                                                                                                                                                             |

### Lo que NO toca este sub-PR

- Frontend (sub-PRs 3 y 4).
- NestJS `LoansModule` con los 5 tools del LLM (sub-PR 2).
- Seeds de leads de ejemplo (sub-PR 5).
- Bridge a WhatsApp real (sub-PR 6, futuro).

## Decisiones de modelado importantes

### 7 etapas + `rejected` terminal

```
lead → qualification → documentation → credit_evaluation → approval → disbursement → servicing
                                                                ↘ rejected (terminal)
```

Basadas en el flujo SEPS/LOEPS para CACs. Decisión deliberada: NO permitimos
backward transitions en este sub-PR. Si el oficial quiere "devolver" un lead
de `documentation` a `qualification`, se modelará como una segunda fila en
`LoanStageHistory` con `movedBy='officer'` y `fromStage=documentation /
toStage=qualification`. Real-world esto se va a necesitar — está anotado en
ADR-0020 como follow-up.

### 5 tools del LLM (implementadas en sub-PR 2)

- `registerLead` — guarda nombre + teléfono + propósito en etapa `lead`.
- `requestDocument` — pide al socio foto de cédula/rol/planilla en `documentation`.
- `consultCoreBanking` — llama al `CoreBankingAdapter` para verificar al socio y traer historial crediticio.
- `calculateLoanEligibility` — calcula ratio cuota/ingreso y devuelve veredicto.
- `moveToStage` — mueve al socio entre etapas con validación backend de criterios de salida.

### Adapter pattern para core bancario

Mismo razonamiento que `notary-adapter` y `llm-adapter` (ADR-0004):

- Hoy hay un solo provider implementado: `mock` con 4 socios sembrados.
- `cobis` es un stub broken (lanza al usarse). Se completa cuando un cliente real firme.
- El service del sub-PR 2 nunca se entera de qué provider está abajo.

### 4 socios sembrados con perfiles distintos

| Cédula     | Nombre                       | Score | Comportamiento esperado                                    |
| ---------- | ---------------------------- | ----- | ---------------------------------------------------------- |
| 0102030405 | María Elena Pacheco Salazar  | 780   | Aprobación clara, ratio cuota/ingreso favorable.           |
| 0203040506 | Carlos Andrés Yánez Vargas   | 580   | Borderline. Debería sugerir contra-oferta o monto chico.   |
| 0304050607 | Ana Lucía Tipán Pilco        | 500   | Socio nuevo sin historial. Default score para nuevos.      |
| 0405060708 | Luis Fernando Chimbo Quishpe | 850   | Buen perfil PERO `hasActiveLoan: true` — flujo de rechazo. |

Cédulas sintéticas — no pertenecen a personas reales, pero pasan el algoritmo
de checksum ecuatoriano para validaciones futuras.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + lint + tests

```bash
npm install
npm test          # esperado: 537 verdes
npm run lint
npx tsc -p packages/core-banking-adapter/tsconfig.lib.json --noEmit
npx tsc -p apps/api/tsconfig.app.json --noEmit
```

### Sección 2 — Migración Prisma

```bash
# Aplica la migración en local (debe ser idempotente — Prisma detecta si ya está).
npm run db:migrate

# Inspeccionar el SQL generado:
cat packages/db/prisma/migrations/20260623172738_add_demo_09_loan_funnel/migration.sql
```

Esperado:

- Crea `enum "LoanStage"` con 8 valores.
- Crea tablas `LoanLead`, `LoanConversation`, `LoanStageHistory`.
- Crea índices (`LoanLead_tenantId_currentStage_idx`, etc).
- Crea foreign keys hacia `Tenant` con `ON DELETE CASCADE`.
- **No drops**, **no alters de tablas existentes**.

### Sección 3 — MockCoreBankingAdapter

```bash
npx vitest run packages/core-banking-adapter
# Esperado: 18 tests verdes
```

Verifica manualmente que:

- Los 4 socios sembrados están disponibles vía `verifyMember`.
- Cédula desconocida → `null` sin lanzar.
- `getCreditHistory` lanza si el `memberId` no existe.
- `createLoanRequest` con `memberId` desconocido → lanza.
- `updateLoanRequest` al pasar a `disbursed` stampa `disbursedAt`.
- El factory cachea instancias (mismo provider, segunda call devuelve la misma).

### Sección 4 — Registro del demo

Verifica que el endpoint `GET /api/v1/demos` ya devuelve `loans` en
status `coming-soon` con la audiencia descrita en el ADR.

## Hallazgos esperados que NO son bug

- El demo aparece `coming-soon` — está bien hasta sub-PR 5.
- `CobisAdapter` lanza al usarse — está bien, es stub para sub-PR futuro.
- No hay `LoansModule` todavía — sub-PR 2.
- No hay UI todavía — sub-PRs 3 y 4.
- No hay seeds de leads de ejemplo — sub-PR 5.

## Riesgos guardados

- **Backward transitions de etapa** — no modeladas en sub-PR 1. Cuando un
  oficial necesite "devolver" un lead, hay que tomar la decisión: ¿columna
  separada `previousStage`, o segunda fila en `LoanStageHistory`?
- **Cooldown post-rejected** — el real-world quiere permitir re-aplicar
  tras X días. Hay que sumar `LoanLead.rejectedUntil: DateTime?` en sub-PR 5.
- **Bridge a WhatsApp real** — pendiente de decisión post-deprecación de
  Meta On-Premise (sub-PR 6 futuro).

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
