# Handoff Codex — Demo 09 sub-PR 3 (Frontend vista socio · chat tipo WhatsApp)

## Qué cambia este sub-PR

Tercer sub-PR del tren ADR-0020. Frontend Next.js de la **vista socio** del Demo 09 — la página `/demo/loans` con UI tipo WhatsApp que consume el `POST /api/v1/loans/chat` (SSE) del sub-PR 2.

### Archivos tocados

| Archivo                                                  | Cambio                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/api/types-loans.ts`                    | Tipos espejo del backend: LoanStage, EligibilityResult, LoanLeadDto, eventos SSE.                 |
| `apps/web/src/lib/api/loans.ts`                          | Cliente HTTP: getLoan, listLoans, getLoanMetrics, subscribeToLoanChat.                            |
| `apps/web/src/lib/api/index.ts`                          | Re-exports.                                                                                       |
| `apps/web/src/lib/api/types.ts`                          | Suma `'loans'` al `DemoId`.                                                                       |
| `apps/web/src/lib/catalog/demos.ts`                      | Entrada `loans` en `DEMOS_CATALOG` con icon `message-square-heart`.                               |
| `apps/web/src/lib/i18n/strings.ts`                       | Strings ES + EN del demo (`loans.*`, `audience.loans.*`, `demos.loans.*`, `costMini.uses.loans`). |
| `apps/web/src/components/shared/cost-defaults.ts`        | Cubre `'loans'` para que el Record exhaustivo compile.                                            |
| `apps/web/src/components/demo/loans/StageBadge.tsx`      | Chip de etapa actual con colores por etapa.                                                       |
| `apps/web/src/components/demo/loans/MessageBubble.tsx`   | Bubble user/assistant/system con tiempo y caret de streaming.                                     |
| `apps/web/src/components/demo/loans/EligibilityCard.tsx` | Card especial cuando el bot llama calculate_loan_eligibility.                                     |
| `apps/web/src/components/demo/loans/LoanComposer.tsx`    | Textarea + send estilo WA con auto-resize y enter-to-send.                                        |
| `apps/web/src/components/demo/loans/use-loan-chat.ts`    | Hook que orquesta el SSE, mantiene messages, currentStage, error.                                 |
| `apps/web/src/app/(shell)/demo/loans/page.tsx`           | Página completa con header + chat + composer.                                                     |
| `apps/web/src/app/styles/ui-kit.css`                     | Bloque CSS `Demo 09 — Funnel de préstamos` (~370 líneas).                                         |

### Lo que NO entra

- Vista oficial / kanban — sub-PR 4.
- Backend (ya entregado en sub-PR 2).
- Seeds de leads de ejemplo — sub-PR 5.
- Upload real de fotos cuando el bot llama request_document — el frontend muestra el evento pero el upload físico queda como deuda (sub-PR 4 o 5).
- Bridge a WhatsApp real — sub-PR 6 futuro.

## Decisiones de UX

### Tipos de bubble

- **user (derecha, verde claro)** — mensaje del socio.
- **assistant (izquierda, blanco con borde)** — respuesta del bot. Streaming con caret parpadeante.
- **system (centrado, gris)** — eventos de tool (register_lead, request_document, consult_core_banking, move_to_stage). Texto corto con label + summary.
- **eligibility card** — caso especial: cuando llega un evento `tool` con `tool=calculate_loan_eligibility`, no se muestra como system message, sino como bubble assistant con una card estructurada (verdict + reason + maxAmount + tasa + cuota + ratio).

### Header del chat

- Avatar circular con icon `message-square-heart`.
- Título "Coopi · Asistente de crédito".
- Subtítulo "En línea" con dot verde.
- StageBadge al lado derecho con color por etapa.

### Streaming

- El último bubble assistant muestra un caret parpadeante hasta que llega `done`.
- Cuando `done` llega y el último bubble assistant quedó vacío (porque solo llamó tools), se remueve del array.
- Composer disabled mientras `isStreaming=true`.

### Errores

- Si llega `error_event` o falla la red, se muestra panel inline con título + mensaje + botón "Reintentar".
- Reintentar reemite el último mensaje user.

## Cómo verificar

```bash
npm install
npm test          # 565 verdes
npm run lint
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build
```

Esperado:

- `/demo/loans` aparece en el árbol del build.
- Sin errores de typecheck ni lint.

### Smoke test manual

Requiere stack arriba + tenant con `loans` en `enabledDemos`:

1. Login en el tenant.
2. Ir a `/demo/loans`.
3. Mandar "Hola, soy María Pacheco, mi teléfono es 0999111222, quiero un préstamo de $2000 a 12 meses para capital de trabajo".
4. Ver que aparezca el bubble user verde + bubble assistant blanco con texto streaming.
5. Eventualmente debería aparecer un system message "Datos del socio registrados" cuando el bot llame `register_lead`.
6. El StageBadge debería actualizarse de "Inicio" a "Pre-calificación" cuando llegue el primer `stage_changed`.

## Hallazgos esperados que NO son bug

- Upload de documentos no está cableado — sub-PR 4/5.
- Vista oficial kanban no existe todavía — sub-PR 4.
- El demo aparece como `live` en el catálogo del frontend pero el backend lo mantiene `coming-soon` en `DemoRegistryService`. Eso es deliberado: el frontend lee el catálogo local (que ya estaría live), pero el `@RequireDemo('loans')` guard del backend rechaza si el tenant no lo tiene en `enabledDemos`. Pasa a `available` en sub-PR 5.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
