# Handoff Codex — Demo 10 sub-PR 2 (BiModule backend + 2 tools)

## Qué cambia este sub-PR

Segundo sub-PR del tren ADR-0021. Entrega el **backend completo del Demo 10**:

1. **`sql-safety.ts`** — capa crítica de sanitización (regex + whitelist + LIMIT + multi-tenant filter).
2. **2 tools del LLM**: `run_sql` y `render_chart`.
3. **System prompt** para "Coopi Analytics" con catálogo de tablas.
4. **`BiService`** con loop de tool calling + ejecución vía `prisma.$queryRawUnsafe`.
5. **`BiController`** con endpoint SSE gated por `@RequireDemo('bi')`.
6. **57 tests nuevos** (47 del sql-safety + 10 del render-chart parser).

### Archivos tocados

| Archivo                                               | Cambio                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/app/bi/sql-safety.ts`                   | Sanitización SQL con 5 capas de defensa.                                                             |
| `apps/api/src/app/bi/sql-safety.test.ts`              | 47 tests de safety (keywords, strings literals, comments, CTE, ambigüedad de tenantId en JOIN, etc). |
| `apps/api/src/app/bi/dto/bi.dto.ts`                   | `BiChatRequestDto`, `BiChartSpec`, eventos SSE.                                                      |
| `apps/api/src/app/bi/tools/run-sql.tool.ts`           | Tool def + parser.                                                                                   |
| `apps/api/src/app/bi/tools/render-chart.tool.ts`      | Tool def + parser con 6 chart types.                                                                 |
| `apps/api/src/app/bi/tools/render-chart.tool.test.ts` | 10 tests del parser de spec.                                                                         |
| `apps/api/src/app/bi/tools/index.ts`                  | Barrel + `BI_TOOLS` array.                                                                           |
| `apps/api/src/app/bi/prompts.ts`                      | System prompt con catálogo completo de las 5 tablas.                                                 |
| `apps/api/src/app/bi/bi.service.ts`                   | Orquestador con loop tool calling.                                                                   |
| `apps/api/src/app/bi/bi.controller.ts`                | `POST /api/v1/bi/chat` con SSE.                                                                      |
| `apps/api/src/app/bi/bi.module.ts`                    | Wiring.                                                                                              |
| `apps/api/src/app/app.module.ts`                      | Registra `BiModule`.                                                                                 |

### Lo que NO entra

- Frontend (sub-PR 3).
- Persistencia de conversaciones (sub-PR 4 si la sumamos).
- Registro del demo en `DemoRegistryService` — sub-PR 5.
- Bridge a un warehouse real del cliente — futuro (mock por ahora).

## Las 5 capas de seguridad del SQL

1. **Strip de comentarios + string literals** — para que el análisis no confunda keywords dentro de strings/comments.
2. **Rechazo de keywords destructivas** — `INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|COPY|VACUUM|ANALYZE|BEGIN|COMMIT|ROLLBACK|CALL|MERGE|...`
3. **Rechazo de `;`** — un solo statement por llamada.
4. **Whitelist de tablas** — solo `BiAgencia`, `BiSocio`, `BiPrestamo`, `BiCaptacion`, `BiCuota`. Tablas en CTE (`WITH ... AS`) se reconocen y permiten.
5. **Inyección obligatoria de `tenantId`** — para CADA tabla del FROM/JOIN, con prefijo de alias para evitar ambigüedad. `LIMIT 1000` si falta.

## Bugs reales descubiertos por el smoke test

**Bug 1 — WHERE dentro de FILTER()**: el inyector original metía el filtro de tenantId dentro del primer `WHERE` que encontraba, que podía ser uno dentro de `COUNT(*) FILTER (WHERE ...)`. **Fix**: implementé `findTopLevelMatch` que recorre balanceando paréntesis y solo matchea WHERE en nivel 0.

**Bug 2 — `tenantId` ambiguo en JOIN**: con `FROM "BiPrestamo" p JOIN "BiAgencia" a`, Postgres rechaza `WHERE "tenantId" = '...'` con `column reference "tenantId" is ambiguous`. **Fix**: inyectamos un predicado por cada tabla referenciada, con prefijo de alias (`"p"."tenantId" = '...' AND "a"."tenantId" = '...'`).

**Bug 3 — alias consume keyword siguiente**: el regex greedy capturaba `JOIN` como alias del `FROM` anterior, y nunca volvía a verlo. **Fix**: cambio a captura manual de alias con `ALIAS_BLACKLIST` (`JOIN`, `WHERE`, `GROUP`, `ORDER`, etc).

## Smoke test end-to-end (3 queries representativas)

Las 3 corren contra los 29.6K filas sembradas del sub-PR 1, con el SQL sanitizado real:

```sql
-- 1. Mora por agencia (JOIN entre 2 tablas BI → ambos filtros de tenantId)
SELECT a.nombre,
       COUNT(*) FILTER (WHERE p.estado IN ('vencido','castigado')) AS vencidos,
       ROUND(100.0 * COUNT(*) FILTER (...) / COUNT(*), 2) AS pct_mora
FROM "BiPrestamo" p
JOIN "BiAgencia" a ON a.id = p."agenciaId"
GROUP BY a.nombre

-- 2. Cartera por producto (single table, con WHERE existente)
SELECT "productoTipo", SUM("montoUsd") FROM "BiPrestamo"
WHERE estado = 'vigente' GROUP BY "productoTipo"

-- 3. Desembolsos mensuales (date_trunc, INTERVAL, ORDER)
SELECT date_trunc('month', "fechaDesembolso") AS mes, SUM("montoUsd")
FROM "BiPrestamo"
WHERE "fechaDesembolso" >= NOW() - INTERVAL '12 months'
GROUP BY mes ORDER BY mes
```

Las 3 devuelven datos coherentes:

- Mora top: Machala 20%, Riobamba 18.8%, Quito Centro 17.4%.
- Cartera vivienda $11.3M, auto $2.3M, microempresa $1.8M.
- 13 meses de desembolsos con valores entre $119K y $619K.

## Cómo verificar

```bash
npm install
npm test         # 622 verdes (47 nuevos del sql-safety + 10 del render-chart parser)
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit
```

Para reproducir el smoke test end-to-end:

```bash
# Requiere sub-PR 1 aplicado (seed-bi.ts corrido)
npm run db:seed:tenants && npm run db:seed:loans && npm run db:seed:bi

# Crear script ad-hoc con 3 queries representativas (ver "Smoke test" arriba)
# o invocar el endpoint con un cURL contra un stack montado.
```

## Hallazgos esperados que NO son bug

- El demo `bi` sigue sin estar en `DemoRegistryService` — entra en sub-PR 5.
- El frontend `/demo/bi` no existe todavía — sub-PR 3.
- No hay persistencia de conversaciones (`conversationId` es un UUID por sesión cliente).
- El service NO usa un usuario DB read-only — confía en sql-safety + el filtro de tenantId. Para producción, un cliente paranoico podría configurar `DATABASE_URL_READONLY` para esta query path (anotado en el ADR como deuda).

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
