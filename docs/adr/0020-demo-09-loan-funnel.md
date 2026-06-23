# ADR-0020 — Demo 09: Funnel de préstamos asistido por IA para cooperativas

- **Estado:** Aceptado
- **Fecha:** 2026-06-23 (aceptado al cierre del sub-PR 5)
- **Decidido por:** Jorge (arquitecto) + Edguitar (negocio)
- **Demo objetivo:** Demo 09 — _"Chat tipo WhatsApp + funnel inteligente para préstamos en cooperativas de ahorro y crédito (CACs)"_

---

## Contexto del cliente

Las **cooperativas de ahorro y crédito (CACs)** ecuatorianas — reguladas por la **SEPS** (Superintendencia de Economía Popular y Solidaria) bajo el marco **LOEPS** (Ley Orgánica de Economía Popular y Solidaria) — gestionan préstamos a sus socios con un proceso que típicamente involucra:

1. **Captación de leads** vía oficina, llamadas, formularios web → mucha fricción, alto drop-off.
2. **Recolección de documentos** (cédula, planilla de servicios básicos, rol de pagos, certificado laboral) → semanas de ida y vuelta.
3. **Pre-calificación crediticia** manual o semi-automática.
4. **Evaluación por comité de crédito** según el monto.
5. **Aprobación → desembolso → cobro**.

El problema que el cliente verbaliza es **la velocidad y la fricción** de las primeras 3 etapas. El analogía con **growth marketing funnels** que propuso Jorge es acertada: cada etapa tiene su tasa de conversión, cada drop-off es un costo, y la IA puede **mover al socio entre etapas** según la evidencia conversacional.

---

## Decisión

Construimos **Demo 09 — Funnel de préstamos asistido por IA** como **un solo demo con dos vistas coordinadas**:

- **Vista socio** (`/demo/loans`) — UI tipo WhatsApp donde el socio conversa con un asistente IA, sube fotos de documentos, pregunta sobre cuotas y plazos, y avanza por las etapas del funnel.
- **Vista oficial de crédito** (`/demo/loans/funnel`) — Kanban con todos los socios del tenant en sus etapas actuales + tarjetas con resumen de cada lead + métricas de conversión.

Lo que **conecta las dos vistas** es que **el LLM mueve al socio entre etapas según evidencia**, llamando tools del backend. Cuando el oficial mira el kanban, lo ve actualizarse en tiempo real (SSE).

### Decisiones de diseño cerradas con Jorge (2026-06-23)

| #   | Pregunta                      | Respuesta                                                                                                         |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Tipo de cooperativa           | **Ahorro y crédito** (SEPS, CACs). Lenguaje: socio, cuota, encaje, score interno.                                 |
| 2   | Scoring crediticio            | **LLM con tool calculadora** — el bot llama `calculateLoanEligibility()` con income, deuda, score, monto y plazo. |
| 3   | Integración con core bancario | **Simular conexión a CRM/core externo** vía `MockCoreBankingAdapter`.                                             |
| 4   | Canal WhatsApp                | **UI tipo WhatsApp dentro del demo** (sub-PRs 1-4). Bridge a WhatsApp real pendiente de decisión.                 |

### Las 7 etapas estándar del funnel

Definimos un funnel canónico para CACs basado en el flujo típico de SEPS:

```
1. lead                  → Socio contactó. Datos mínimos (nombre, teléfono).
2. qualification         → Pre-calificación: monto solicitado, plazo, propósito.
3. documentation         → Subiendo cédula, rol, planilla. OCR + validación.
4. credit_evaluation     → Score interno, ratio cuota/ingreso, comité si > monto.
5. approval              → Decisión: aprobado, rechazado, contra-oferta.
6. disbursement          → Firma de pagaré, desembolso a cuenta del socio.
7. servicing             → Cobro de cuotas. Estado del préstamo activo.
```

Cada etapa tiene **criterios de entrada y salida explícitos**. El LLM solo puede mover al socio a la etapa siguiente si los criterios de salida de la actual se cumplen — eso lo garantizamos vía la tool `moveToStage()` que valida en el backend antes de aceptar.

---

## Arquitectura

### Containers afectados

```
apps/web/  (Next.js)
  app/(shell)/demo/loans/page.tsx        ← vista socio: chat tipo WhatsApp
  app/(shell)/demo/loans/funnel/page.tsx ← vista oficial: kanban + métricas
  components/demo/loans/
    ChatWhatsApp.tsx                      ← bubble UI estilo WA
    DocumentUploader.tsx                  ← upload de foto cédula / rol
    StageBadge.tsx                        ← chip con etapa actual
    FunnelKanban.tsx                      ← columnas por etapa
    LeadCard.tsx                          ← card con resumen del lead
    FunnelMetrics.tsx                     ← tasas de conversión por etapa

apps/api/  (NestJS)
  loans/
    loans.module.ts
    loans.controller.ts                   ← REST: POST chat, GET lead, list leads
    loans.service.ts                      ← orquestación
    tools/                                ← tool calling del LLM
      calculate-eligibility.tool.ts
      request-document.tool.ts
      move-to-stage.tool.ts
      consult-core-banking.tool.ts
      register-lead.tool.ts

packages/core-banking-adapter/  (nuevo)
  src/lib/
    types.ts                              ← CoreBankingAdapter, MemberInfo, etc.
    providers/
      mock-core-banking.ts                ← implementación con datos sembrados
      adapter-factory.ts                  ← coreBankingFor(provider, deps)
```

### Por qué un `packages/core-banking-adapter` separado

Mismo razonamiento que `@org/notary-adapter` y `@org/llm-adapter` (ADR-0004): si mañana un cliente real conecta a su **Cobis**, **Compac**, **Conexus** o **SQL Server propio**, lo único que cambia es el provider — la lógica del `LoansService` no se toca. Tests de los tools del LLM se vuelven triviales con un mock estructural.

### Adapter pattern del core bancario

```ts
export interface CoreBankingAdapter {
  /** Verifica que la cédula exista en el sistema cooperativo. */
  verifyMember(input: { idNumber: string }): Promise<MemberInfo | null>;

  /** Consulta historial crediticio + score interno. */
  getCreditHistory(memberId: string): Promise<CreditHistory>;

  /** Registra una nueva solicitud de préstamo en el core. */
  createLoanRequest(input: LoanRequestInput): Promise<{ requestId: string }>;

  /** Actualiza el estado de una solicitud existente. */
  updateLoanRequest(input: {
    requestId: string;
    stage: LoanStageId;
    data?: unknown;
  }): Promise<void>;
}

export interface MemberInfo {
  memberId: string;
  fullName: string;
  idNumber: string;
  joinedAt: Date;
  shareCapital: number; // aporte de capital del socio
  hasActiveLoan: boolean;
}

export interface CreditHistory {
  internalScore: number; // 0-1000
  monthlyIncome: number;
  monthlyDebt: number;
  lastLoanClosedAt: Date | null;
}
```

### Tools que expone el LLM al socio

Las 5 tools que el orquestador IA puede llamar durante la conversación:

| Tool                       | Cuándo                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `registerLead`             | Etapa `lead` → guarda nombre + teléfono + propósito.                                |
| `requestDocument`          | Etapa `documentation` → pide al socio una foto (cédula, rol, planilla).             |
| `consultCoreBanking`       | Etapa `qualification` o `credit_evaluation` → consulta al `MockCoreBankingAdapter`. |
| `calculateLoanEligibility` | Etapa `credit_evaluation` → calcula ratio cuota/ingreso y devuelve veredicto.       |
| `moveToStage`              | Cualquier etapa → si los criterios de salida se cumplen, mueve al socio.            |

### Modelo de datos (Prisma)

Modelos nuevos en `schema.prisma`:

```prisma
model LoanLead {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(...)
  fullName      String
  phone         String
  idNumber      String?
  purpose       String?
  requestedAmount  Decimal?
  termMonths    Int?
  currentStage  LoanStage @default(lead)
  /// Estado on-core: requestId que devolvió el CoreBankingAdapter.
  coreRequestId String?
  /// Snapshot del último análisis crediticio.
  lastEligibility Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  conversations LoanConversation[]
  stageHistory  LoanStageHistory[]
}

enum LoanStage {
  lead
  qualification
  documentation
  credit_evaluation
  approval
  disbursement
  servicing
  rejected     // estado terminal alternativo
}

model LoanConversation {
  id        String   @id @default(cuid())
  leadId    String
  lead      LoanLead @relation(...)
  /// 'user' o 'assistant'.
  role      String
  content   String   @db.Text
  /// Si el assistant llamó una tool, qué tool + input + output.
  toolCall  Json?
  createdAt DateTime @default(now())
}

model LoanStageHistory {
  id        String    @id @default(cuid())
  leadId    String
  lead      LoanLead  @relation(...)
  fromStage LoanStage?
  toStage   LoanStage
  /// Quién/qué movió la etapa. 'llm' | 'officer' | 'system'.
  movedBy   String
  reason    String?
  createdAt DateTime  @default(now())
}
```

---

## Alternativas consideradas

### A — Sin adapter, todo en `LoansService` con SQL directo

**Descartada.** Mañana cuando el cliente real (Cooperativa Andalucía, JEP, etc) quiera conectar su core bancario, hay que reescribir el service. El adapter pattern cuesta 1 día más ahora y ahorra 2 semanas después.

### B — Conversación con state machine explícita en código

**Descartada para este demo.** Una state machine codificada es más rígida y menos demostrable como "asistente IA". El LLM con tools + validación en `moveToStage()` da el mismo efecto + permite que el LLM razone sobre ambigüedades (ej. socio dice "tengo un préstamo en BanEcuador, ¿afecta?" — un state machine no responde; el LLM sí).

### C — Bridge a WhatsApp real desde el sub-PR 1

**Diferida.** Empezamos con UI simulada (sub-PRs 1-4). El bridge real depende de la decisión post-deprecación de WhatsApp Business On-Premise (Meta sunset oct 2025). Se decide cuando un cliente concreto firme.

### D — Comité de crédito como step humano dentro del flujo

**Aceptada parcialmente.** El backend tiene la etapa `credit_evaluation` y la siguiente es `approval`. La transición la dispara la tool `moveToStage` que en producción requeriría un comité humano cuando el monto > umbral. En el demo lo simulamos con un "auto-approve si monto < $5000, else mark as pending_committee" — explicado en pantalla.

---

## Plan de implementación — 5 sub-PRs incrementales

| Sub-PR   | Qué entrega                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (este) | ADR + schema Prisma (`LoanLead`, `LoanConversation`, `LoanStageHistory`, enum `LoanStage`) + migración + package `@org/core-banking-adapter` con tipos + factory + `MockCoreBankingAdapter` con miembros sembrados. |
| 2        | `LoansModule` en `apps/api`: las 5 tools del LLM, flujo conversacional con tool calling streaming (reusa `chat.streamWithTools`).                                                                                   |
| 3        | Frontend `/demo/loans` (vista socio) — UI tipo WhatsApp con bubbles, upload de fotos, etapa actual visible.                                                                                                         |
| 4        | Frontend `/demo/loans/funnel` (vista oficial) — Kanban con leads por etapa + métricas de conversión + actualización SSE.                                                                                            |
| 5        | i18n ES + EN final, semillas de leads de ejemplo, runbook, ADR a `Aceptado`.                                                                                                                                        |

### Sub-PRs futuros (post-demo)

| Sub-PR     | Qué entrega                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 6 (futuro) | Bridge a WhatsApp real (Cloud API + orquestador on-prem o gateway no-oficial — decisión pendiente). |
| 7 (futuro) | Adapter real para Cobis / Conexus / Compac según el cliente que firme.                              |

---

## Cuándo revisar

- Si un cliente firma con un core bancario específico → abrir ADR-0021 con la implementación de ese adapter.
- Si Meta confirma una alternativa oficial post-deprecación de On-Premise que valga la pena → reabrir la decisión D.
- Si el funnel resulta demasiado lineal para casos reales (ej. socio que vuelve a etapa anterior por documento rechazado) → extender `LoanStage` con transiciones backwards y permitir loops controlados.
