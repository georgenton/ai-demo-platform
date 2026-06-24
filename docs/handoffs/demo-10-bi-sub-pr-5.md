# Handoff Codex — Demo 10 sub-PR 5 (Cierre del tren · activación + runbook + ADR Aceptado)

## Qué cambia este sub-PR

Quinto y último sub-PR del tren ADR-0021. Cierra el Demo 10:

1. **Demo `bi` pasa a `available`** en `DemoRegistryService`.
2. **Test del registry actualizado**: los 10 demos del roadmap son `available`.
3. **Industria `cooperativas`** suma `bi` a su `enabledDemos`.
4. **Tenant `demo-cooperativa`** suma `bi` en `seed-loans.ts` (update + create).
5. **ADR-0021 → Aceptado** + README de ADRs.
6. **Runbook** `docs/runbook-demo-10-bi.md` con activación, golden path (10 preguntas), troubleshooting.

### Archivos tocados

| Archivo                                                | Cambio                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/api/src/app/demos/demo-registry.service.ts`      | Entrada `bi` con `status: 'available'`, route `/demo/bi`, descripción + audience.     |
| `apps/api/src/app/demos/demo-registry.service.test.ts` | Test actualizado: 10 demos del roadmap, todos `available`.                            |
| `packages/db/prisma/seed-tenants.ts`                   | Industria `cooperativas` ahora tiene `bi` en `enabledDemos`. WelcomeCopy actualizado. |
| `packages/db/prisma/seed-loans.ts`                     | Tenant `demo-cooperativa` upsertea con `enabledDemos` incluyendo `bi`.                |
| `docs/adr/0021-demo-10-bi-dynamic.md`                  | Estado `Propuesto` → `Aceptado`.                                                      |
| `docs/adr/README.md`                                   | Fila de ADR-0021 actualizada a `Aceptado`.                                            |
| `docs/runbook-demo-10-bi.md`                           | Runbook operativo nuevo.                                                              |

### Lo que NO entra (deuda registrada)

- **Adapter para warehouse real del cliente** — paralelo a `core-banking-adapter` cuando firme un cliente.
- **Heatmap chart** — el LLM puede pedirlo, el frontend cae en fallback "no soportado".
- **Export PDF/Excel** del dashboard.
- **Reordenar drag&drop** en el dashboard — el backend ya tiene PATCH `order`, falta el handle UI.
- **Polling/SSE para refresh real-time** del dashboard.
- **Agendado** (re-correr una query semanalmente y mandar el chart por email).

## El runbook trae 10 preguntas golden path

| #   | Pregunta                                          | Chart esperado                        |
| --- | ------------------------------------------------- | ------------------------------------- |
| 1   | ¿Cuál agencia tiene más mora?                     | Bar — Machala / Riobamba / Quito top. |
| 2   | Cartera vigente por tipo de producto              | Pie/Bar — vivienda $11M.              |
| 3   | Desembolsos mensuales del último año              | Line — 12 puntos.                     |
| 4   | Distribución de socios por ocupación              | Pie — empleado 35%.                   |
| 5   | Top 10 agencias por cartera total                 | Bar ordenado.                         |
| 6   | Socios nuevos por trimestre últimos 2 años        | Bar/Line con tendencia.               |
| 7   | Captaciones por tipo de producto, montos promedio | Bar — plazo fijo dominante.           |
| 8   | Préstamos castigados por agencia                  | Bar ordenado.                         |
| 9   | Edad promedio del socio por ocupación             | Bar horizontal.                       |
| 10  | Cuota promedio que pagan los socios               | Single número o bar por producto.     |

## Cómo verificar

```bash
npm install
npm test              # 629 verdes
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && npx next build  # /demo/bi y /demo/bi/dashboard en el árbol

# Seed end-to-end (local)
npm run db:seed:tenants       # industria 'cooperativas' con bi
npm run db:seed:loans         # tenant 'demo-cooperativa' con bi
npm run db:seed:bi            # warehouse con ~29.6K filas
```

Verificar en BD:

```sql
-- Industria
SELECT slug, "enabledDemos" FROM "Industry" WHERE slug='cooperativas';
-- Esperado: enabledDemos incluye 'bi'

-- Tenant
SELECT slug, "enabledDemos" FROM "Tenant" WHERE slug='demo-cooperativa';
-- Esperado: enabledDemos incluye 'bi'

-- Warehouse
SELECT
  (SELECT count(*) FROM "BiAgencia"   WHERE "tenantId"=t.id) AS agencias,
  (SELECT count(*) FROM "BiPrestamo"  WHERE "tenantId"=t.id) AS prestamos,
  (SELECT count(*) FROM "BiCuota"     WHERE "tenantId"=t.id) AS cuotas
FROM "Tenant" t WHERE t.slug='demo-cooperativa';
-- Esperado: 10, 2500, ~24600
```

Verificar en HTTP:

```bash
curl http://localhost:3000/api/v1/demos | jq '.demos[] | select(.id=="bi")'
# Esperado: status: "available"
```

## Smoke test manual de la demo en vivo

Ver "Smoke test end-to-end" y "Golden path — 10 preguntas que demuestran el valor" en el runbook.

Resumen del flujo:

1. Login en `demo-cooperativa`.
2. Ir a `/demo/bi`. Hacer pregunta 1 del golden path: "¿Cuál agencia tiene más mora?".
3. Ver SQL ejecutado + tabla + bar chart + narrativa.
4. Click "Guardar al dashboard" → modal → confirmar.
5. Hacer 2-3 más preguntas y guardarlas.
6. Ir a `/demo/bi/dashboard` → ver grid de cards refrescando.
7. Refresh + delete cards.

## Riesgos guardados

- Si el modelo LLM es chico (private-mac con Llama 3 8B), puede inventar columnas y caer en loop de errores. Para demos en vivo, usar el provider cloud con modelo grande.
- El seed `db:seed:bi` requiere que `demo-cooperativa` exista (depende de `db:seed:loans`). El orden está documentado en el runbook.
- El frontend hace re-ejecución de queries del dashboard al montarse — abrir el dashboard con 10+ items dispara 10 queries en paralelo. Postgres lo aguanta sin problema con el dataset sembrado pero un cliente real con warehouse grande podría querer staggered loading.

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
