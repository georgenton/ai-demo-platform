# Runbook — Demo 10 · BI dinámico (ADR-0021)

Cómo activar y operar el **Demo 10 — Dashboard inteligente / BI dinámico** para CACs ecuatorianas.

## Resumen del demo

- Vista de pregunta: `/demo/bi` — composer + chat con Coopi Analytics.
- Vista de dashboard: `/demo/bi/dashboard` — grid de charts guardados que se refrescan al cargar.
- Backend: NestJS `BiModule` con 2 tools del LLM (`run_sql`, `render_chart`) + `sql-safety.ts` con 5 capas de defensa.
- Warehouse mock: 5 tablas (`BiAgencia`, `BiSocio`, `BiPrestamo`, `BiCaptacion`, `BiCuota`) con ~29.6K filas sembradas.
- Persistencia del dashboard: tabla `BiDashboardItem` per-tenant.

## Prerrequisitos

- Stack arriba (api + web + Postgres). En local: `npm run demo:start`.
- Las variables de entorno del LLM ya configuradas (`CHAT_PROVIDER`, `CHAT_API_KEY`, `CHAT_MODEL`). **El demo NO requiere env vars adicionales.**

## Activación paso a paso

### 1. Aplicar la migración de Prisma

El backend lo hace automáticamente al iniciar (`prisma migrate deploy`). En local:

```bash
npm run db:migrate
```

Las dos migraciones del Demo 10 son aditivas:

- `20260624144425_add_demo_10_bi_warehouse` (sub-PR 1) — 5 tablas BI.
- `20260624201728_add_bi_dashboard_item` (sub-PR 4) — tabla del dashboard.

### 2. Asegurar la industria 'cooperativas' con `bi` habilitado

El sub-PR 5 sumó `bi` al `enabledDemos` de la industria. Si tu BD viene de antes:

```bash
# Local:
npm run db:seed:tenants

# Railway:
npm run db:seed:tenants:railway
```

Verifica:

```sql
SELECT "enabledDemos" FROM "Industry" WHERE slug='cooperativas';
-- Esperado: incluye 'bi'
```

### 3. Sembrar el warehouse del tenant demo

```bash
# Local:
npm run db:seed:tenants    # crea industria
npm run db:seed:loans      # crea tenant 'demo-cooperativa' con bi habilitado
npm run db:seed:bi         # llena el warehouse con ~29.6K filas

# Railway:
npm run db:seed:tenants:railway
npm run db:seed:loans:railway
npm run db:seed:bi:railway
```

Verifica:

```sql
SELECT
  (SELECT count(*) FROM "BiAgencia"    WHERE "tenantId"=t.id) AS agencias,
  (SELECT count(*) FROM "BiSocio"      WHERE "tenantId"=t.id) AS socios,
  (SELECT count(*) FROM "BiPrestamo"   WHERE "tenantId"=t.id) AS prestamos,
  (SELECT count(*) FROM "BiCaptacion"  WHERE "tenantId"=t.id) AS captaciones,
  (SELECT count(*) FROM "BiCuota"      WHERE "tenantId"=t.id) AS cuotas
FROM "Tenant" t WHERE t.slug='demo-cooperativa';
-- Esperado: 10, 1000, 2500, 1500, ~24600
```

### 4. Crear usuario logueable (opcional, si no existe)

```bash
DATABASE_URL="<url>" npx prisma studio --schema packages/db/prisma/schema.prisma
# Tabla User → crear:
#   email: gerente@coop-andina.demo
#   passwordHash: bcrypt de tu password
#   role: 'tenant-admin'
#   tenantId: <id del tenant 'demo-cooperativa'>
```

Generar el hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuPassword123', 12))"
```

### 5. Smoke test end-to-end

1. Login con el user del tenant cooperativa.
2. Ir a `/demo/bi`.
3. Click en una pregunta sugerida o escribir manualmente.
4. Ver: SQL ejecutado + tabla + gráfico Recharts + narrativa con tokens streaming.
5. Click "Guardar al dashboard" → modal → confirmar.
6. Ir a `/demo/bi/dashboard` (link "Mi dashboard" en el header).
7. Ver el chart re-ejecutándose y renderizándose con datos frescos.
8. Click "Refrescar" → el icon gira → vuelve a renderizar.
9. Click trash → confirmar → la card desaparece.

## Cosas a saber durante una demo en vivo

### Golden path — 10 preguntas que demuestran el valor

Estas preguntas exploran distintos cortes y disparan tipos de gráfico variados:

| #   | Pregunta                                                      | Esperado                                   |
| --- | ------------------------------------------------------------- | ------------------------------------------ |
| 1   | "¿Cuál agencia tiene más mora?"                               | Bar chart con top agencias por % de mora.  |
| 2   | "Cartera vigente por tipo de producto"                        | Pie o bar con vivienda en la cima ($11M).  |
| 3   | "Desembolsos mensuales del último año"                        | Line chart con 12 puntos.                  |
| 4   | "Distribución de socios por ocupación"                        | Pie chart con 7 categorías.                |
| 5   | "Top 10 agencias por cartera total"                           | Bar chart ordenado.                        |
| 6   | "¿Cuántos socios nuevos por trimestre en los últimos 2 años?" | Bar chart o line con tendencia.            |
| 7   | "Captaciones por tipo de producto, montos promedio"           | Bar chart con plazo fijo dominante.        |
| 8   | "Préstamos castigados por agencia"                            | Bar chart, ordenable por cantidad.         |
| 9   | "Edad promedio del socio por ocupación"                       | Bar chart horizontal.                      |
| 10  | "¿Cuál es la cuota promedio que pagan los socios?"            | Single número o bar agrupado por producto. |

### Refinement conversacional

El LLM mantiene contexto durante la sesión. Probá:

1. Preguntar: "Cartera por producto"
2. Después: "Y filtra solo los activos"
3. Después: "Compáralo con los desembolsos del último mes"

### Costos en LLM

- ~6K tokens input (system prompt + history) + ~1.5K output por pregunta.
- A pricing default ≈ $0.03 por consulta.
- 150 consultas/mes (5 usuarios × 30 c/u) ≈ $4-5/mes para una cooperativa mediana.

## Troubleshooting

### El chart no se renderiza

**Causa probable**: el LLM eligió `heatmap`, que es el único tipo no soportado.

- Mensaje: "El tipo de gráfico recibido no está soportado todavía."
- Workaround: refrasear la pregunta para que el LLM elija bar/line/area/pie/treemap.

### "Tabla(s) fuera de la whitelist"

**Causa**: el LLM intentó hacer JOIN con una tabla que no es del warehouse BI (ej. `User` o `Tenant`).

- El sanitizer lo rechaza correctamente.
- El LLM lee el error y corrige en el siguiente turn.

### Endpoint 403 al preguntar

**Causa**: el tenant no tiene `bi` en su `enabledDemos`.

```bash
DATABASE_URL="..." npx prisma studio --schema packages/db/prisma/schema.prisma
# Tabla Tenant → agregar 'bi' al array `enabledDemos`.
```

### El dashboard está vacío después de guardar

**Causa**: la card del dashboard pertenece a otro tenant.

```sql
SELECT id, title, "tenantId" FROM "BiDashboardItem"
WHERE "tenantId"=(SELECT id FROM "Tenant" WHERE slug='demo-cooperativa');
```

### Postgres devuelve "ambiguous tenantId"

**No debería pasar** — el sanitizer inyecta prefijos de alias. Si pasa, es un bug del sub-PR 2. Reportar con el SQL crudo del LLM (visible en logs del backend).

### El LLM inventa columnas que no existen

**Causa típica con modelos chicos** (private-mac con Llama 3 8B). El LLM no sigue exactamente el catálogo.

- El error de Postgres ("column does not exist") llega al LLM como tool_result.
- Reintenta corrigiendo. Si no converge en `MAX_TURNS=6`, falla.
- Workaround para demos en vivo: usa `claude-sonnet-4-7` o equivalente.

## Cosas para el siguiente sprint

Documentadas en el ADR-0021 como follow-ups:

- **Adapter real para warehouse del cliente** — cuando un cliente firme con SQL Server / Oracle, sumar un adapter paralelo al `core-banking-adapter`.
- **Heatmap chart** — `react-heatmap-grid` o composición con `ScatterChart`.
- **Export PDF/Excel del dashboard** — botón "Compartir" que genera un snapshot.
- **Agendado** — re-correr una query todos los lunes y mandar el chart por email.
- **Reordenar drag&drop** — el backend ya tiene PATCH `order`; falta el handle UI.
- **Polling/SSE para refresh real-time** del dashboard.

## Referencias

- ADR: [docs/adr/0021-demo-10-bi-dynamic.md](./adr/0021-demo-10-bi-dynamic.md)
- Handoffs Codex: [docs/handoffs/demo-10-bi-sub-pr-{1,2,3,4,5}.md](./handoffs/)
- Backend: `apps/api/src/app/bi/`
- Frontend: `apps/web/src/app/(shell)/demo/bi/` + `apps/web/src/components/demo/bi/`
- Warehouse seed: `packages/db/prisma/seed-bi.ts`
- Schema BI: 6 tablas (5 warehouse + 1 dashboard item).
