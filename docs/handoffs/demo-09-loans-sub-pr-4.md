# Handoff Codex — Demo 09 sub-PR 4 (Frontend vista oficial · kanban + drawer)

## Qué cambia este sub-PR

Cuarto sub-PR del tren ADR-0020. Frontend Next.js de la **vista del oficial de crédito** del Demo 09 — la página `/demo/loans/funnel` con kanban + KPIs + drawer de detalle. Consume los endpoints `GET /api/v1/loans`, `GET /api/v1/loans/funnel/metrics` y `GET /api/v1/loans/:id` del sub-PR 2.

### Archivos tocados

| Archivo                                                   | Cambio                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/demo/loans/use-funnel-data.ts`   | Hook que carga leads + metrics, con polling cada 15s y guardia anti-race contra refetches concurrentes. |
| `apps/web/src/components/demo/loans/LeadCard.tsx`         | Tarjeta del kanban: nombre + monto + plazo + última razón + tiempo relativo.                            |
| `apps/web/src/components/demo/loans/FunnelMetrics.tsx`    | 4 KPIs (Activos / En evaluación / Aprobados / Drop-off).                                                |
| `apps/web/src/components/demo/loans/FunnelKanban.tsx`     | Kanban de 8 columnas con header + count + body con cards.                                               |
| `apps/web/src/components/demo/loans/LeadDetailDrawer.tsx` | Panel lateral con detalle completo del lead + último análisis (EligibilityCard).                        |
| `apps/web/src/app/(shell)/demo/loans/funnel/page.tsx`     | Página completa: header + KPIs + estados (loading / error / empty / kanban) + drawer.                   |
| `apps/web/src/lib/i18n/strings.ts`                        | ~30 claves nuevas para `funnel.*` (ES + EN).                                                            |
| `apps/web/src/app/styles/ui-kit.css`                      | Bloque CSS del kanban + drawer (~390 líneas).                                                           |

### Lo que NO entra

- Backend (sub-PR 2).
- Vista socio del chat (sub-PR 3).
- Push SSE para refresh en vivo del kanban — sub-PR 5 lo puede sumar (hoy es polling 15s).
- Drag-and-drop de cards entre columnas — fuera de scope (las transiciones las hace el LLM).
- Seeds de leads de ejemplo — sub-PR 5.

## Decisiones de UX

### Estructura de la página

1. **Header** con título + subtítulo + audiencia + chip de "Actualizado a las HH:MM" + botón "Actualizar".
2. **KPIs (4)** en grid horizontal (2×2 en mobile).
3. **Estados:**
   - `loading`: spinner centrado durante la primera carga.
   - `error`: panel inline con botón "Reintentar".
   - `empty`: ilustración + texto explicando que aparece la primera tarjeta cuando un socio empiece el chat.
   - `kanban`: 8 columnas con scroll horizontal si la pantalla es chica.
4. **Drawer lateral** que aparece al hacer click en una card.

### Refresh

- Polling automático cada **15s** (`useFunnelData` default).
- Counter anti-race: si dos refetches están en curso al mismo tiempo, solo aplicamos el resultado del más reciente.
- Botón "Actualizar" fuerza refetch inmediato.
- `lastUpdatedAt` se muestra para el oficial.

### Drawer

- Aparece desde la derecha (380-420px de ancho).
- Backdrop semi-transparente; click en backdrop o tecla ESC lo cierran.
- Carga el `LoanLeadDto` completo via `getLoan(id)` para tener el último análisis crediticio.
- 4 secciones: Etapa actual (StageBadge) · Datos del socio · Solicitud · Último análisis (EligibilityCard reusada del sub-PR 3).

### Color por etapa

Cada columna tiene un acento de color a la izquierda:

- `lead`: gris.
- `qualification` / `documentation`: azul (brand).
- `credit_evaluation` / `approval`: mint (accent).
- `disbursement` / `servicing`: verde (success).
- `rejected`: rojo (danger), con opacity reducida.

## Cómo verificar

```bash
npm install
npm test          # 565 verdes
npm run lint
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build
```

Esperado:

- `/demo/loans/funnel` aparece en el árbol del build.
- Sin errores de typecheck ni lint.

### Smoke test manual

Requiere stack arriba + tenant con `loans` en `enabledDemos` y al menos 1 lead creado:

1. Login en el tenant.
2. Ir a `/demo/loans/funnel`.
3. Ver los KPIs cargados (al menos `Activos > 0` si hay leads).
4. Ver el kanban con las cards en sus columnas.
5. Click en una card → drawer abre con detalle. ESC cierra.
6. Esperar ~15s → ver que `Actualizado a las HH:MM` cambia.

## Hallazgos esperados que NO son bug

- No hay deep-link `/demo/loans/funnel?leadId=...` para abrir el drawer directo — es nice-to-have, no crítico.
- Polling de 15s puede dar la sensación de "lag" si un lead se mueve. Trade-off conocido — el push real entra en sub-PR 5 o más tarde.
- Drag-and-drop entre columnas no está — las transiciones las hace el LLM via `move_to_stage`. Esto es intencional para el demo: el oficial es observador, no operador del estado del funnel.
- `lastStageReason` se muestra truncado a 40 chars con `title` HTML para el hover.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
