# Handoff Codex — Demo 10 sub-PR 4 (Dashboard guardado)

## Qué cambia este sub-PR

Persistencia + UI del dashboard guardado del Demo 10. Cuando al usuario le gusta un chart, puede "Guardar al dashboard"; en `/demo/bi/dashboard` ve la grid con todos los charts guardados del tenant, cada uno re-ejecutando su SQL al cargar (datos siempre frescos, sin re-prompt al LLM).

### Archivos tocados

| Archivo                                                                  | Cambio                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma`                                       | +1 modelo `BiDashboardItem` + relación inversa en `Tenant`.                                                     |
| `packages/db/prisma/migrations/20260624201728_add_bi_dashboard_item/...` | Migración aditiva (CREATE TABLE + índice + FK).                                                                 |
| `packages/db/src/lib/db.ts`                                              | Exporta el type `BiDashboardItem`.                                                                              |
| `apps/api/src/app/bi/dto/dashboard.dto.ts`                               | DTOs: `CreateDashboardItemDto`, `UpdateDashboardItemDto`, `BiDashboardItemDto`, `BiDashboardItemExecuteResult`. |
| `apps/api/src/app/bi/dashboard.service.ts`                               | `BiDashboardService` con CRUD + `execute()` que re-sanitiza el SQL guardado.                                    |
| `apps/api/src/app/bi/dashboard.service.test.ts`                          | 7 tests: rechaza SQL inválido, multi-tenant isolation, re-sanitización defense in depth.                        |
| `apps/api/src/app/bi/bi.controller.ts`                                   | +5 endpoints: list/create/update/delete/execute.                                                                |
| `apps/api/src/app/bi/bi.module.ts`                                       | Registra `BiDashboardService`.                                                                                  |
| `apps/web/src/lib/api/types-bi-dashboard.ts`                             | Tipos espejo del backend.                                                                                       |
| `apps/web/src/lib/api/bi-dashboard.ts`                                   | Cliente HTTP con 5 funciones.                                                                                   |
| `apps/web/src/lib/api/index.ts`                                          | Re-exports.                                                                                                     |
| `apps/web/src/components/demo/bi/SaveToDashboard.tsx`                    | Botón + modal para guardar un turn al dashboard.                                                                |
| `apps/web/src/components/demo/bi/TurnView.tsx`                           | Suma `SaveToDashboard` cuando hay chart + sql sin error.                                                        |
| `apps/web/src/components/demo/bi/DashboardCard.tsx`                      | Card del grid: ejecuta SQL al montar, muestra chart con DynamicChart. Botones refresh + delete.                 |
| `apps/web/src/app/(shell)/demo/bi/dashboard/page.tsx`                    | Página con grid de cards + estados loading/error/empty.                                                         |
| `apps/web/src/app/(shell)/demo/bi/page.tsx`                              | Suma link "Mi dashboard" en el header.                                                                          |
| `apps/web/src/lib/i18n/strings.ts`                                       | +30 claves `bi.save.*` y `bi.dashboard.*` (ES + EN).                                                            |
| `apps/web/src/app/styles/ui-kit.css`                                     | +330 líneas para modal + grid + cards.                                                                          |

### Lo que NO entra

- Reordenar drag&drop entre cards — el endpoint PATCH soporta `order` pero el frontend solo lo lee. Mejora nice-to-have para el futuro.
- Re-fetch automático periódico — el card refresca solo al montarse o cuando el usuario hace click en "Refrescar". El refresh real-time queda pendiente (sub-PR 5 puede sumar polling).
- Compartir un chart guardado por link — los items son per-tenant; los usuarios del mismo tenant ya los ven.
- Demo `bi` registrado en `DemoRegistryService` — sigue sub-PR 5.

## Decisiones de seguridad

### Re-sanitización en `execute()`

Cuando el frontend pide `POST /bi/dashboard/:id/execute`, el backend NO ejecuta el SQL guardado directo. Lo pasa por `sanitizeBiSql(item.sql, tenantId)` de nuevo:

- Si alguien manipuló la fila en BD (cambió INSERT INTO en lugar del SELECT original), el sanitizer lo rechaza.
- El tenantId se inyecta del REQUEST, no del item — incluso si dos tenants comparten un item por accidente, cada uno ve solo sus datos.

### Multi-tenant isolation

Todas las queries de Prisma usan `where: { id, tenantId }`. Un tenant nunca puede leer/editar/ejecutar un item de otro tenant. Hay un test específico que lo verifica.

### `CreateDashboardItemDto` re-valida en backend

El frontend manda `sql` + `chartSpec`. El backend re-valida el SQL con sql-safety antes de persistir. Si el LLM upstream falló y el SQL no es válido, no llega a la tabla.

## UX flow

```
1. Usuario en /demo/bi pregunta "¿Cuál agencia tiene más mora?"
   → ve chart bar generado por IA.

2. Click "Guardar al dashboard" → modal con título (default = chart.title).
   → editable, click "Guardar".

3. POST /bi/dashboard → backend valida SQL + crea fila.

4. Modal cierra, botón muestra "Guardado" 2s, después vuelve a normal.

5. Usuario va a /demo/bi/dashboard:
   → GET /bi/dashboard lista items del tenant.
   → cada DashboardCard llama POST /:id/execute al montarse.
   → re-renderiza chart con datos frescos.

6. Otro usuario del MISMO tenant entra a /demo/bi/dashboard:
   → ve los mismos charts (el dashboard es per-tenant).
```

## Cómo verificar

```bash
npm install
npm test          # 629 verdes (+7 nuevos del dashboard service)
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build  # /demo/bi/dashboard en el árbol
```

### Smoke test manual

Requiere stack arriba + tenant con `bi` en `enabledDemos` + warehouse sembrado.

1. Login en `demo-cooperativa`.
2. Ir a `/demo/bi`. Hacer una pregunta cualquiera ("cartera por producto").
3. Cuando llegue el chart, click "Guardar al dashboard". Modal abre con título precargado.
4. Confirmar guardado.
5. Click "Mi dashboard" en el header.
6. Ver la card del chart guardado. Esperar 1-2s mientras ejecuta.
7. Verificar el chart con los mismos datos.
8. Click "Refrescar" → el icon gira → vuelve a renderizar.
9. Click trash → confirmar → la card desaparece.

## Hallazgos esperados que NO son bug

- **Modal nativo `confirm/alert`** para borrar y errores. Se usa el del browser para mantener el sub-PR acotado; en producción real se sumaría un dialog custom.
- **Sin reordenar drag&drop** — el endpoint PATCH soporta `order` pero el frontend no expone control. Nice-to-have futuro.
- **El executedAt no se actualiza si el card no se desmonta** — al hacer refresh el state interno cambia, pero no hay timestamp visible "actualizado hace X minutos".
- **Heatmap sigue unsupported** — cualquier item guardado con `chartType: 'heatmap'` mostrará el fallback "no soportado" cuando se renderice en el dashboard.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
