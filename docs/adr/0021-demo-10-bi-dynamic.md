# ADR-0021 — Demo 10: Dashboard inteligente / BI dinámico para cooperativas

- **Estado:** Aceptado
- **Fecha:** 2026-06-24 (aceptado al cierre del sub-PR 5)
- **Decidido por:** Jorge (arquitecto) + Edguitar (negocio)
- **Demo objetivo:** Demo 10 — _"Pregunta en español los indicadores de la cooperativa y obtén tabla + gráfico inteligente al instante"_

---

## Contexto del cliente

Las **cooperativas de ahorro y crédito (CACs)** ecuatorianas usan herramientas tipo Power BI alimentadas por **cubos de información** preparados manualmente por el equipo de data engineering. El problema que el cliente verbaliza:

1. Cuando la gerencia necesita un corte nuevo del dashboard ("morosidad por agencia × tipo de producto en los últimos 6 meses"), el desarrollador tiene que **modificar el cubo OLAP** o sumar una vista al modelo semántico.
2. Eso demora **2 semanas en promedio** entre toma de requerimiento, ejecución y validación.
3. La gerencia llega tarde a las decisiones — el negocio se mueve más rápido que el ciclo de modelado.

Lo que **no funciona** para resolverlo desde IA:

- "Generar el cubo con IA" — el cubo OLAP sigue siendo un artefacto material que vive en SSAS / Power BI dataset / Mondrian. La IA puede sugerir el modelado pero no reemplazar la materialización ni la validación de reglas de negocio. El ahorro no se ve en una demo de 15 minutos.

Lo que **sí funciona**:

- **Dashboard inteligente que reemplaza el flujo cubo→Power BI**: el usuario pregunta en español, el sistema traduce a SQL contra el warehouse, ejecuta, y el LLM elige el tipo de gráfico apropiado (line para tendencia, bar para comparativa, heatmap para 2 dimensiones, treemap para composición). Sin cubo, sin modelo semántico, sin developer.

---

## Decisión

Construimos **Demo 10 — Dashboard inteligente de cooperativa** como una página con:

- **Composer** estilo chat donde el oficial / gerente escribe la pregunta en español.
- **Área de respuesta** con dos paneles:
  - **Tabla** con los datos crudos del SQL.
  - **Gráfico dinámico** del tipo que el LLM eligió (line / bar / area / pie / treemap / heatmap), con título auto-generado.
- **Narrativa** corta del LLM explicando el resultado en 2-3 oraciones.
- **Refinement conversacional**: "y por agencia", "solo el último año", "compáralo con el mismo mes del año pasado".

### Decisiones de diseño cerradas con Jorge (2026-06-24)

| #   | Pregunta           | Respuesta                                                                                                        |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Dominio de datos   | **Indicadores de cooperativa** — continuidad con Demos 08 y 09. Mock de 5 tablas con datos sembrados.            |
| 2   | Librería de charts | **Recharts** — componentes React declarativos, ~95KB, line/bar/area/pie/scatter/treemap nativos, SSR-compatible. |
| 3   | Seguridad del SQL  | **Read-only + whitelist + LIMIT obligatorio**. Defense in depth con usuario DB sin permisos de escritura.        |
| 4   | Forma de respuesta | **Tool calling con 2 tools**: `run_sql` + `render_chart`. Permite refinement conversacional natural.             |

---

## Arquitectura

### Containers afectados

```
apps/web/  (Next.js)
  app/(shell)/demo/bi/page.tsx              ← composer + chat + chart panel
  components/demo/bi/
    BiComposer.tsx                          ← input estilo chat
    SqlResultTable.tsx                      ← tabla con paginación cliente
    DynamicChart.tsx                        ← decide qué Recharts component según spec
    charts/{LineChart,BarChart,...}.tsx     ← wrappers Recharts tipados
    NarrativePanel.tsx                      ← texto del LLM con badge "AI-generated"
    use-bi-chat.ts                          ← hook con SSE + estado de queries

apps/api/  (NestJS)
  bi/
    bi.module.ts
    bi.controller.ts                        ← REST: POST chat (SSE), GET dashboard
    bi.service.ts                           ← orquestación + tool calling
    tools/
      run-sql.tool.ts                       ← whitelist + sanitización + ejecución read-only
      render-chart.tool.ts                  ← valida spec del gráfico
    sql-safety.ts                           ← regex + whitelist + LIMIT injector

packages/db/prisma/
  schema.prisma                             ← +5 modelos del warehouse
  seed-bi.ts                                ← seed con ~5K filas de indicadores
```

### Las 5 tablas del warehouse mock

```prisma
model BiAgencia {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(...)
  codigo      String   // "AG-001", "AG-002", ...
  nombre      String   // "Agencia Quito Centro", "Agencia Cuenca Sur"
  ciudad      String
  provincia   String
  fechaApertura DateTime
  // ~10 agencias por tenant
}

model BiSocio {
  id           String   @id @default(cuid())
  tenantId     String
  agenciaId    String
  agencia      BiAgencia @relation(...)
  fechaIngreso DateTime
  edad         Int
  sexo         String   // 'M' | 'F' | 'X'
  ocupacion    String   // categoría
  ingresoMensualUsd Decimal @db.Decimal(10, 2)
  // ~1000 socios por tenant
}

model BiPrestamo {
  id              String   @id @default(cuid())
  tenantId        String
  socioId         String
  socio           BiSocio  @relation(...)
  agenciaId       String   // denormalizado para queries rápidas
  productoTipo    String   // 'consumo', 'vivienda', 'microempresa'
  montoUsd        Decimal  @db.Decimal(12, 2)
  plazoMeses      Int
  tasaAnual       Decimal  @db.Decimal(5, 2)
  fechaDesembolso DateTime
  fechaCancelacion DateTime?
  estado          String   // 'vigente', 'cancelado', 'vencido', 'castigado'
  diasMora        Int      @default(0)
  // ~2500 préstamos por tenant
}

model BiCaptacion {
  id           String   @id @default(cuid())
  tenantId     String
  socioId      String
  agenciaId    String
  productoTipo String   // 'ahorro_vista', 'plazo_fijo', 'ahorro_navideno'
  saldoUsd     Decimal  @db.Decimal(12, 2)
  fechaApertura DateTime
  fechaCierre  DateTime?
  estado       String   // 'activa', 'cerrada'
  // ~1500 captaciones por tenant
}

model BiCuota {
  id            String   @id @default(cuid())
  tenantId      String
  prestamoId    String
  prestamo      BiPrestamo @relation(...)
  numero        Int      // 1, 2, ..., plazoMeses
  fechaProgramada DateTime
  fechaPago     DateTime?
  montoUsd      Decimal  @db.Decimal(10, 2)
  estado        String   // 'pagada', 'pendiente', 'vencida'
  diasAtraso    Int      @default(0)
  // ~15000 cuotas por tenant (5-10 cuotas en promedio por préstamo)
}
```

**Total: ~20K filas sembradas por tenant** con datos coherentes (cuotas que cuadran con monto/plazo, mora consistente con días, etc.).

### Las 2 tools que expone el LLM

| Tool           | Cuándo                                                          | Qué hace                                                            |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `run_sql`      | Cuando el LLM ya tiene clara la pregunta del usuario.           | Ejecuta SELECT read-only contra el warehouse. Devuelve rows.        |
| `render_chart` | Después de tener resultados, cuando hay forma de visualizarlos. | Recibe `{chartType, xAxis, yAxis, series, title}` y dispara render. |

El loop es idéntico a HrService / LoansService:

1. LLM lee la pregunta del usuario + el catálogo de tablas (en el system prompt).
2. Llama `run_sql` con un SELECT bien formado.
3. Backend valida (whitelist + read-only + LIMIT), ejecuta, devuelve rows.
4. LLM lee los resultados, elige tipo de gráfico, llama `render_chart`.
5. Backend pasa la spec al frontend (vía SSE event `chart`).
6. Frontend renderiza con Recharts.
7. LLM emite narrativa final.

### Seguridad del SQL

**Defense in depth en 4 capas:**

1. **System prompt**: instrucciones explícitas "solo SELECT, solo estas tablas, siempre WHERE tenantId=...".
2. **Validator regex en `sql-safety.ts`**:
   - Rechaza si match `\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b`.
   - Rechaza si match `;` después de strippear comments y strings.
   - Rechaza si referencia una tabla que no esté en la whitelist `['BiAgencia', 'BiSocio', 'BiPrestamo', 'BiCaptacion', 'BiCuota']`.
3. **`tenantId` filter injector**: si el SQL no tiene `WHERE` con `tenantId = $1`, el service lo agrega obligatoriamente antes de ejecutar.
4. **LIMIT injector**: si no hay LIMIT, inyecta `LIMIT 1000` para evitar OOM si el LLM se confunde.
5. **Usuario DB read-only**: el `DATABASE_URL_READONLY` apunta a un user de Postgres sin permisos INSERT/UPDATE/DELETE/DDL. Si todo lo anterior falla, Postgres lo rechaza.

Las capas 4 y 5 son configuración operativa documentada en el runbook (sub-PR 5).

---

## Alternativas consideradas

### A — Generar el cubo OLAP con IA

**Descartada.** El cubo es un artefacto material (SSAS / Power BI dataset). El ahorro real no se ve en una demo y la validación de reglas de negocio sigue siendo manual.

### B — Single-call structured output (1 sola llamada al LLM con JSON)

**Descartada.** Pierde refinement conversacional ("y por agencia") sin re-correr toda la pipeline. El usuario quiere conversación.

### C — Apache ECharts en lugar de Recharts

**Descartada para el demo.** Más tipos disponibles (sankey, sunburst) pero +250KB de bundle y API más pesada. Los 6 tipos de Recharts cubren el 95% de los casos.

### D — Validador SQL con AST (node-sql-parser)

**Descartada para el demo.** Más estricto pero suma dependencia + ~200 líneas de validación. Las 4 capas existentes son suficientes para un demo + el usuario read-only es el "cinturón final".

### E — Cargar el warehouse de la cooperativa real

**Descartada hasta firmar.** El demo se hace contra mock sembrado. Cuando un cliente real firme, se conecta a su warehouse via vista materializada + adapter pattern (paralelo a `core-banking-adapter` del Demo 09).

---

## Plan de implementación — 5 sub-PRs

| Sub-PR   | Qué entrega                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1 (este) | ADR + 5 modelos Prisma del warehouse + migración aditiva + `seed-bi.ts` con ~20K filas + comando npm `db:seed:bi`.             |
| 2        | `BiModule` en `apps/api`: 2 tools (`run_sql`, `render_chart`) + `sql-safety.ts` con las 4 capas + service + controller.        |
| 3        | Frontend `/demo/bi`: composer + chat + tabla + wrappers Recharts (Line/Bar/Area/Pie/Treemap/Heatmap) + i18n inicial.           |
| 4        | Dashboard guardado: persistir queries favoritas + grid con charts guardados ("mi cooperativa hoy"). Refinement conversacional. |
| 5        | i18n + EN final, runbook con queries de ejemplo (10 golden questions), ADR → Aceptado, demo → `available`.                     |

### Sub-PRs futuros (post-demo)

| Sub-PR     | Qué entrega                                                                     |
| ---------- | ------------------------------------------------------------------------------- |
| 6 (futuro) | Adapter real para el warehouse del cliente (paralelo a `core-banking-adapter`). |
| 7 (futuro) | Export a PDF/Excel del dashboard generado.                                      |
| 8 (futuro) | Agendado: re-correr una query todos los lunes y mandar el chart por email.      |

---

## Cuándo revisar

- Si un cliente real firma y tiene warehouse con esquema muy distinto al mock → ADR-0022 con el adapter de warehouse real.
- Si Recharts queda corto para algún tipo de gráfico común (ej. mapas geo de Ecuador) → considerar Apache ECharts como segunda librería.
- Si el LLM genera SQL que toma >5s consistentemente → sumar caché de queries por hash.
