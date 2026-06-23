# Handoff Codex — Demo 09 sub-PR 2 (LoansModule backend + 5 tools del LLM)

## Qué cambia este sub-PR

Segundo sub-PR del tren ADR-0020. Entrega el **backend completo del Demo 09**:

1. **5 tools del LLM** en `apps/api/src/app/loans/tools/`:
   - `register_lead` — guarda datos iniciales del socio.
   - `request_document` — pide al socio una foto (id_card / payroll / utility_bill).
   - `consult_core_banking` — verifica al socio en el core + trae historial.
   - `calculate_loan_eligibility` — evalúa las 6 reglas de negocio (sin LLM).
   - `move_to_stage` — mueve al socio entre etapas con validación backend.
2. **System prompt** (`prompts.ts`) que define a "Coopi", el bot del demo, con personalidad y reglas duras.
3. **LoansService** con el loop de tool calling reusando `chat.streamWithTools` (mismo patrón que HrService / NotarizeService).
4. **LoansController** con 4 endpoints REST + SSE, todos gated por `@RequireDemo('loans')`.
5. **LoansModule** registrado en `app.module.ts`, inyectando `MockCoreBankingAdapter` via DI token `CORE_BANKING`.
6. **28 tests nuevos** del evaluador de elegibilidad y del validador de transiciones de etapa.

### Archivos tocados

| Archivo                                                           | Cambio                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/app/loans/dto/loans.dto.ts`                         | DTOs: ChatLoanRequestDto, LoanLeadDto, LoanLeadListItemDto, EligibilityResult, LoanChatEvent, etc. |
| `apps/api/src/app/loans/tools/register-lead.tool.ts`              | Tool + parser (valida nombre + teléfono ecuatoriano + propósito).                                  |
| `apps/api/src/app/loans/tools/request-document.tool.ts`           | Tool + parser (id_card / payroll / utility_bill).                                                  |
| `apps/api/src/app/loans/tools/consult-core-banking.tool.ts`       | Tool + parser (valida cédula 10 dígitos).                                                          |
| `apps/api/src/app/loans/tools/calculate-eligibility.tool.ts`      | Tool + parser + `evaluateEligibility` con las 6 reglas (lógica pura).                              |
| `apps/api/src/app/loans/tools/move-to-stage.tool.ts`              | Tool + parser + `validateStageTransition` (criterios por etapa).                                   |
| `apps/api/src/app/loans/tools/index.ts`                           | Barrel + array `LOAN_TOOLS`.                                                                       |
| `apps/api/src/app/loans/tools/calculate-eligibility.tool.test.ts` | 14 tests (6 reglas + cálculo cuota + parser).                                                      |
| `apps/api/src/app/loans/tools/move-to-stage.tool.test.ts`         | 14 tests (forward-only + criterios por etapa + rejected terminal).                                 |
| `apps/api/src/app/loans/prompts.ts`                               | System prompt parametrizado por lead (etapa, datos recolectados).                                  |
| `apps/api/src/app/loans/loans.service.ts`                         | Orquestador del chat con tool calling + helpers (loadLead, applyUpdates, executeTool).             |
| `apps/api/src/app/loans/loans.controller.ts`                      | POST chat (SSE), GET :id, GET list, GET funnel/metrics.                                            |
| `apps/api/src/app/loans/loans.module.ts`                          | DI del CoreBankingAdapter via `coreBankingFor('mock', {})`.                                        |
| `apps/api/src/app/app.module.ts`                                  | Registra `LoansModule`.                                                                            |
| `packages/db/src/lib/db.ts`                                       | Exporta `LoanStage`, `LoanLead`, `LoanConversation`, `LoanStageHistory`.                           |

### Lo que NO entra

- Frontend (sub-PRs 3 y 4).
- Seeds de leads de ejemplo (sub-PR 5).
- Tests del LoansService end-to-end con mock del LLM — quedó como deuda. Los tests pasan via los unit tests de las funciones puras.
- Bridge a WhatsApp real (sub-PR 6 futuro).

## Decisiones técnicas

### Tool calling loop (idéntico a HrService)

`MAX_TURNS = 8`. Por cada turn:

1. Llama `chat.streamWithTools(messages, LOAN_TOOLS, { provider })`.
2. Por cada `tool_use_complete`: ejecuta la tool, persiste resultado, emite evento al cliente.
3. Si `stopReason === 'tool_use'`: re-loopea con los `tool_results`.
4. Sino: cierra y emite `done`.

### Persistencia

- Mensaje del socio + respuesta del bot → `LoanConversation` (con `toolCall` JSON si aplica).
- Cambio de etapa → `LoanStageHistory` con `movedBy='llm'`.
- Updates al lead (fullName, idNumber, lastEligibility, etc) → `LoanLead.update()` en transacción con `LoanStageHistory`.

### Las 6 reglas del eligibility evaluator

Determinísticas — input mismo, output mismo. Implementadas como función pura testeable sin LLM:

1. `hasActiveLoan === true` → rechazo.
2. `internalScore < 500` → rechazo.
3. `shareCapitalUsd < 20` → rechazo.
4. Cuota+deuda mensual / ingreso > 40% → contra-oferta (calcula monto máximo).
5. Score 500-650 + ingreso < $1000 → tasa 16%.
6. Score 650+ + ingreso > $1000 → tasa 14%.

Cuota mensual calculada con fórmula francesa (amortización constante).

### Validación de transiciones (móve_to_stage)

Forward-only en este sub-PR. Backward transitions quedan para el sub-PR 5 (cuando el oficial necesite "devolver" un lead). Cada etapa tiene criterios de salida explícitos — el validator devuelve `{ok:false, error}` que el LLM lee como `tool_result.isError` y corrige.

## Cómo verificar

```bash
npm install
npm test              # esperado: 565 verdes
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit
```

### Smoke test manual del endpoint

Una vez que `loans` esté en `enabledDemos` del tenant:

```bash
# 1. Iniciar conversación nueva.
curl -X POST http://localhost:3000/api/v1/loans/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <jwt>' \
  -d '{"message": "Hola, quiero un préstamo de $2000 a 12 meses"}'
# → SSE stream con tokens del bot + posible tool_use de register_lead/qualification.

# 2. Listar leads (kanban).
curl http://localhost:3000/api/v1/loans -H 'Authorization: Bearer <jwt>'

# 3. Métricas del funnel.
curl http://localhost:3000/api/v1/loans/funnel/metrics -H 'Authorization: Bearer <jwt>'
```

## Hallazgos esperados que NO son bug

- `LoansService` no tiene tests end-to-end propios — la cobertura crítica vive en los unit tests de las 2 funciones puras (eligibility + stage validation). Tests del loop quedaron como deuda.
- El demo sigue como `coming-soon` en el catálogo — pasa a `available` en sub-PR 5.
- Frontend no consume todavía estos endpoints — sub-PRs 3 y 4.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
