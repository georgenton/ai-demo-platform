# Handoff Codex — Demo 10 sub-PR 3 (Frontend `/demo/bi` con Recharts)

## Qué cambia este sub-PR

Frontend Next.js del Demo 10 — página `/demo/bi` donde el usuario pregunta en español, ve el SQL ejecutado, el gráfico generado por IA y la tabla de resultados.

### Archivos tocados

| Archivo                                                 | Cambio                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/api/types-bi.ts`                      | Tipos espejo del backend: BiChartSpec, BiChatEvent (token/sql/rows/chart/done/error).                                     |
| `apps/web/src/lib/api/bi.ts`                            | Cliente `subscribeToBiChat` con SSE.                                                                                      |
| `apps/web/src/lib/api/index.ts`                         | Re-exports de tipos + función.                                                                                            |
| `apps/web/src/lib/api/types.ts`                         | Suma `'bi'` al union `DemoId`.                                                                                            |
| `apps/web/src/lib/catalog/demos.ts`                     | Entrada `bi` en `DEMOS_CATALOG` con icon `bar-chart-3`.                                                                   |
| `apps/web/src/lib/i18n/strings.ts`                      | ~30 claves nuevas para `bi.*`, `funnel.*` quedó intacto, `audience.bi.*`, `demos.bi.*`, `costMini.uses.bi` (ES + EN).     |
| `apps/web/src/components/shared/cost-defaults.ts`       | Cubre `'bi'` para que el Record exhaustivo compile (~6K tokens input + 1.5K output por pregunta).                         |
| `apps/web/src/components/demo/bi/use-bi-chat.ts`        | Hook que orquesta el SSE — mantiene `turns[]`, `status`, `error`, `conversationId`. `ask`, `retry`, `reset`.              |
| `apps/web/src/components/demo/bi/BiComposer.tsx`        | Textarea + botón "Preguntar" con auto-resize. Sub-componente `BiSuggestions` con 5 preguntas de ejemplo.                  |
| `apps/web/src/components/demo/bi/DynamicChart.tsx`      | Decide qué componente Recharts renderizar según `chartType`. Soporta line/bar/area/pie/treemap. Heatmap = unsupported.    |
| `apps/web/src/components/demo/bi/charts/chart-utils.ts` | Helpers: `rowsToObjects`, `coerceNumeric` (Postgres devuelve Decimal como string), `formatAxisTick`, `SERIES_COLORS`.     |
| `apps/web/src/components/demo/bi/SqlResultTable.tsx`    | `<details>` con tabla paginada cliente (inicial 20, +50 por click). Header sticky, números con `toLocaleString('es-EC')`. |
| `apps/web/src/components/demo/bi/SqlBlock.tsx`          | `<details>` con SQL ejecutado (post-safety) + chips de tablas tocadas.                                                    |
| `apps/web/src/components/demo/bi/TurnView.tsx`          | Turn completo: pregunta + status + chart + narrativa + tabla + sql + error.                                               |
| `apps/web/src/app/(shell)/demo/bi/page.tsx`             | Página `/demo/bi`. Composer arriba + lista de turns + suggestions cuando está vacío.                                      |
| `apps/web/src/app/styles/ui-kit.css`                    | ~510 líneas de CSS `.bi-*` (composer, suggestions, turns, charts, tablas, sql block, error).                              |

### Lo que NO entra

- Dashboard guardado (queries favoritas, grid persistente) — sub-PR 4.
- Heatmap chart — emite "unsupported" si el LLM lo pide. Sub-PR 4 puede sumarlo.
- Persistencia de conversaciones en BD — sigue por sesión cliente.
- Demo en `DemoRegistryService` — sub-PR 5.

## UX flow

```
/demo/bi
  │
  ▼
Estado vacío:
  ┌─ Composer ──────────────────────────────┐
  │ [textarea]                  [Preguntar] │
  │                                         │
  │ 💡 Preguntas de ejemplo                  │
  │ [¿Cuál agencia tiene más mora?] [...]   │
  └─────────────────────────────────────────┘
  ┌─ Vacío ─────────────────────────────────┐
  │   📊 (icon)                              │
  │   Empieza preguntando                    │
  │   Algunas ideas: morosidad por agencia… │
  └─────────────────────────────────────────┘

Con turns:
  ┌─ Composer (sticky) ────────────────────┐
  ┌─ Turn 1 ───────────────────────────────┐
  │ ❓ "¿Cuál agencia tiene más mora?"      │
  │                                         │
  │ ┌─ Chart [AI badge] ─────────────────┐ │
  │ │ Morosidad por agencia               │ │
  │ │ [bar chart]                         │ │
  │ └─────────────────────────────────────┘ │
  │                                         │
  │ La agencia con mayor mora es Machala…  │
  │                                         │
  │ ▶ Datos · 10 filas                      │
  │ ▶ SQL ejecutado                         │
  └─────────────────────────────────────────┘
```

## Eventos SSE y cómo se muestran

| Evento        | Acción en UI                                                                |
| ------------- | --------------------------------------------------------------------------- |
| `token`       | Se acumula en `turn.narrative`. Caret parpadea mientras streamea.           |
| `sql`         | Se guarda en `turn.sql` + `turn.tablesUsed`. SqlBlock lo muestra colapsado. |
| `rows`        | Se guarda en `turn.columns/rows/rowCount`. SqlResultTable lo muestra.       |
| `chart`       | Se guarda en `turn.chart`. DynamicChart renderiza con Recharts.             |
| `done`        | Persiste `conversationId` para refinement. Cierra `streaming`.              |
| `error_event` | Muestra panel rojo inline con botón "Reintentar".                           |

## Decisiones de UX

- **Pregunta como chip arriba del turn** — el usuario ve qué preguntó después de varios refinements.
- **Chart con AI badge** — visualmente marca lo generado por IA (transparencia).
- **SQL ejecutado colapsado por default** — los usuarios técnicos lo abren para auditar; los gerentes no se distraen.
- **Tabla paginada cliente** — 20 filas inicial, +50 por click. La query del backend ya tiene LIMIT 1000.
- **Postgres Decimal → number** — `coerceNumeric` castea automáticamente los strings numéricos que Postgres devuelve para los `Decimal`.
- **Composer disabled durante streaming** — para evitar disparar otra query en paralelo (el backend la rechazaría con MAX_TURNS=6).

## Cómo verificar

```bash
npm install
npm test          # 622 verdes
npm run lint
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build  # /demo/bi en el árbol
```

### Smoke test manual

Requiere stack arriba + tenant con `bi` en `enabledDemos` + warehouse sembrado (sub-PR 1).

1. Login en `demo-cooperativa`.
2. Ir a `/demo/bi`.
3. Click en una pregunta sugerida o escribir "¿cuál agencia tiene más mora?".
4. Ver: status "Consultando..." → llega SQL → tabla → "Eligiendo gráfico..." → bar chart → narrativa con tokens streaming.
5. Refinement: escribir "y ahora solo de microempresa" → ver que mantiene el contexto.
6. Probar las 5 preguntas sugeridas — line para temporales, bar para comparativas, pie para distribución.

## Hallazgos esperados que NO son bug

- **Heatmap unsupported** — la spec del backend lo permite, pero el renderer cae en `UnsupportedChart`. Sub-PR 4 puede sumar `react-heatmap-grid` o componer con `ScatterChart`.
- **Demo no en `DemoRegistryService`** — sigue siendo deuda hasta sub-PR 5.
- **No hay persistencia entre sesiones** — recargar la página borra el historial. Sub-PR 4 sumará "dashboard guardado".
- **Postgres devuelve Decimal como string** — manejado vía `coerceNumeric`. Si una nueva columna numérica viene como Decimal y no la metemos al cast, el chart la ignora silenciosamente.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
