# Handoff Codex — Demo 10 sub-PR 1 (Warehouse schema + seed BI)

## Qué cambia este sub-PR

Primer sub-PR del tren ADR-0021 (Demo 10 — Dashboard inteligente / BI dinámico para cooperativas). Sienta la **base de datos del warehouse mock** sobre la que el LLM ejecutará SQL en sub-PR 2.

### Archivos tocados

| Archivo                                                                               | Cambio                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/adr/0021-demo-10-bi-dynamic.md`                                                 | ADR completo en estado `Propuesto`.                                                         |
| `docs/adr/README.md`                                                                  | Fila para ADR-0021.                                                                         |
| `packages/db/prisma/schema.prisma`                                                    | +5 modelos (BiAgencia, BiSocio, BiPrestamo, BiCaptacion, BiCuota) + 5 relaciones en Tenant. |
| `packages/db/prisma/migrations/20260624144425_add_demo_10_bi_warehouse/migration.sql` | Migración aditiva (CREATE TABLE + índices + FKs). No drops.                                 |
| `packages/db/src/lib/db.ts`                                                           | Exporta los 5 nuevos types.                                                                 |
| `packages/db/prisma/seed-bi.ts`                                                       | Seed con ~29.6K filas determinísticas en el tenant `demo-cooperativa`.                      |
| `package.json`                                                                        | Comandos `db:seed:bi` y `db:seed:bi:railway`.                                               |

### Lo que NO entra

- Backend `BiModule` con las 2 tools (`run_sql`, `render_chart`) — sub-PR 2.
- `sql-safety.ts` con whitelist + LIMIT injector — sub-PR 2.
- Frontend `/demo/bi` con Recharts — sub-PR 3.
- Registro del demo en `DemoRegistryService` — sub-PR 5 (sigue como deuda).

## Las 5 tablas del warehouse

| Tabla         | Filas/tenant | Columnas clave                                                                   |
| ------------- | ------------ | -------------------------------------------------------------------------------- |
| `BiAgencia`   | 10           | codigo, nombre, ciudad, provincia, fechaApertura                                 |
| `BiSocio`     | 1000         | agenciaId, edad, sexo, ocupacion, ingresoMensualUsd, fechaIngreso                |
| `BiPrestamo`  | 2500         | productoTipo, montoUsd, plazoMeses, tasaAnual, estado, diasMora, fechaDesembolso |
| `BiCaptacion` | 1500         | productoTipo, saldoUsd, estado, fechaApertura, fechaCierre                       |
| `BiCuota`     | ~24600       | numero, fechaProgramada, fechaPago, estado, diasAtraso                           |

Total: ~29.6K filas. Suficiente para queries agregadas no triviales, pero acotado para que un SELECT sin LIMIT no explote.

## Diseño del dataset

### Distribución realista para Ecuador

- **10 agencias** en Pichincha (2), Guayas, Azuay, Tungurahua, Loja, Imbabura, El Oro, Chimborazo, Manabí.
- **Pesos por agencia** (18% Quito Centro, 16% Guayaquil Norte, ...) calibrados para que las queries de "morosidad por agencia" tengan dispersión interesante.
- **Ocupaciones**: empleado 35%, comerciante 25%, agricultor 12%, profesional 10%, emprendedor 8%, estudiante 5%, jubilado 5%.
- **Productos préstamo**: consumo 40%, microempresa 28%, vivienda 15%, auto 12%, educacion 5%. **Microempresa** intencionalmente con mora más alta y tasa entre 18-22%.
- **Tasas anuales** correlacionadas con producto (vivienda 10.5-12.5%, microempresa 18-22%).

### Determinismo

- Usamos `mulberry32` PRNG con seeds fijos (42, 101, 7, 31). Nunca `Math.random` ni `Date.now`.
- Fecha base hardcoded `2026-06-24T00:00:00Z`. Cálculos de antigüedad y mora son reproducibles.

### Idempotencia

- `deleteMany` en orden de dependencia antes de recrear. Cascadas limpian cuotas/captaciones desde el lado padre. Probado corriendo el seed dos veces seguidas — el conteo final es idéntico.

### Correlaciones que el LLM va a poder explotar

- Mora por agencia varía 8-17% (las nuevas tienen más mora).
- Cartera por producto: vivienda ~$11M, auto ~$2.3M, microempresa ~$1.8M, consumo ~$580K.
- Ingreso por ocupación correlaciona con plazo/monto de préstamo.

## Cómo verificar

```bash
npm install
npm test               # 565 verdes
npm run lint
npx tsc -p apps/api/tsconfig.app.json --noEmit

# Aplicar migración
npm run db:migrate

# Sembrar (requiere tenant 'demo-cooperativa' del Demo 09)
npm run db:seed:loans  # crea el tenant si no existe
npm run db:seed:bi     # crea las 29.6K filas BI

# Verificar conteo
psql "$DATABASE_URL" -c "
SELECT 'BiAgencia' AS t, count(*) FROM \"BiAgencia\"
UNION ALL SELECT 'BiSocio', count(*) FROM \"BiSocio\"
UNION ALL SELECT 'BiPrestamo', count(*) FROM \"BiPrestamo\"
UNION ALL SELECT 'BiCaptacion', count(*) FROM \"BiCaptacion\"
UNION ALL SELECT 'BiCuota', count(*) FROM \"BiCuota\";"
# Esperado: 10, 1000, 2500, 1500, ~24600
```

Verificar idempotencia corriendo `npm run db:seed:bi` dos veces — los conteos finales deben ser idénticos.

### Smoke query (lo que el LLM verá)

```sql
SELECT a.nombre, a.provincia,
       COUNT(*) FILTER (WHERE p.estado IN ('vencido','castigado')) AS vencidos,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE p.estado IN ('vencido','castigado')) / COUNT(*), 2) AS pct_mora
FROM "BiPrestamo" p
JOIN "BiAgencia" a ON p."agenciaId" = a.id
WHERE p."tenantId" = '<tenant_id>'
GROUP BY a.nombre, a.provincia
ORDER BY pct_mora DESC LIMIT 5;
```

Esperado: las 5 agencias con mayor % de cartera vencida + castigada, en rango 10-18%.

## Hallazgos esperados que NO son bug

- El demo `bi` NO aparece en el `DemoRegistryService` todavía — entra en sub-PR 5.
- No hay endpoints HTTP para BI — sub-PR 2.
- No hay frontend — sub-PR 3.
- Las cuotas son solo las últimas 12 por préstamo (intencional para mantener el dataset acotado).

## Formato esperado de feedback

```
## ✅ Validaciones que pasaron
- ...

## ⚠️ Hallazgos
- ...

## 🛑 Bloqueantes
- ...
```
