# Handoff Codex — Sub-PR 1 (Embeddings on-prem)

> **Cómo usar este documento.** Está pensado para que Codex (u otro
> agente) pueda verificar el sub-PR 1 sin tener el contexto de la
> conversación que lo originó. Léelo de arriba a abajo y reporta hallazgos
> en el formato pedido al final.

## Qué cambia este sub-PR

Sub-PR 1 de 4 del tren "Embeddings on-prem" (ADR-0018). Es **solo
infraestructura de datos** — no modifica adapters, services ni frontend.
Esos cambios viven en los sub-PRs 2, 3 y 4.

### Archivos tocados

| Archivo                                                                                      | Cambio                                                                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/migrations/20260608170000_embeddings_onprem_wipe_and_768d/migration.sql` | Nueva migración SQL. Wipe + recrea columna `Chunk.embedding` a `vector(768)` + agrega metadata a `Document`.          |
| `packages/db/prisma/schema.prisma`                                                           | `Chunk.embedding` pasa de `vector(1536)` → `vector(768)`. `Document` gana `embeddingsProvider/Model/Dim` + un índice. |
| `docs/adr/0018-embeddings-on-prem.md`                                                        | ADR nuevo que justifica la decisión (supera al ADR-0008).                                                             |
| `docs/adr/0008-openai-embeddings-for-dev.md`                                                 | Marcado como Superseded.                                                                                              |
| `docs/adr/README.md`                                                                         | Índice actualizado.                                                                                                   |
| `docs/handoffs/embeddings-onprem-sub-pr-1.md`                                                | Este documento.                                                                                                       |
| `packages/db/generated/client/**`                                                            | Regenerado automáticamente por `prisma generate`. No revisar manualmente — es código generado.                        |

### Lo que NO toca este sub-PR (importante)

- `packages/llm-adapter/src/lib/embeddings.ts` — sigue como singleton del
  env. El switch dinámico llega en sub-PR 2.
- `apps/api/src/app/chat/chat.service.ts`,
  `apps/api/src/app/ingest/ingest.service.ts` — los services siguen
  llamando a `embeddings.embed()` sin opciones. Cambian en sub-PR 2.
- `packages/rag-core/src/lib/vector-store.ts` — los queries seguirán
  funcionando contra `vector(768)` porque la query construye el string del
  vector dinámicamente — no asumen dim. El filtro por
  `Document.embeddingsProvider/Model` se agrega en sub-PR 2.
- Cualquier archivo de `apps/web` — frontend cambia en sub-PR 3.

## Cómo verificar el sub-PR

### Sección 1 — Schema + cliente Prisma compila

```bash
cd ~/Projects_local/ai-demo-platform
npx prisma generate --schema=packages/db/prisma/schema.prisma
```

**Esperado:** "✔ Generated Prisma Client". Sin errores ni warnings sobre
relations o índices.

### Sección 2 — Tests, lint, typecheck

```bash
npm test                                       # esperado: 415/415 verde
npm run lint                                   # esperado: sin output
npx tsc -p apps/api/tsconfig.app.json --noEmit # esperado: sin output
```

Los tests existentes pasan porque los mocks de embeddings devuelven
arrays de longitud arbitraria y los SQL queries no asumen dim.

### Sección 3 — Migración aplicada contra Railway (manual)

**No correr aún sin coordinación.** El plan de aplicación va en sub-PR 4
(runbook completo). Para verificar que la migración compila SQL válido
sin aplicarla:

```bash
# Esto no aplica nada, solo valida que la migración tiene SQL sintácticamente correcto.
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel packages/db/prisma/schema.prisma \
  --script | head -60
```

**Esperado:** SQL legible con `CREATE TABLE "Document" ... vector(768) ...`
e índices HNSW.

### Sección 4 — Estado final esperado de la base (cuando se aplique)

Cuando alguien corra `npx prisma migrate deploy` contra Railway con esta
migración pendiente:

```sql
-- 1. Cero chunks, cero documents (wipe).
SELECT COUNT(*) FROM "Chunk";    -- esperado: 0
SELECT COUNT(*) FROM "Document"; -- esperado: 0

-- 2. La columna embedding es vector(768), no vector(1536).
SELECT atttypmod
FROM pg_attribute
WHERE attrelid = '"Chunk"'::regclass
  AND attname = 'embedding';
-- esperado: 768 (atttypmod codifica la dim para tipos vector)

-- 3. El índice HNSW se recreó.
SELECT indexdef
FROM pg_indexes
WHERE tablename = 'Chunk'
  AND indexname = 'Chunk_embedding_hnsw_idx';
-- esperado: 'CREATE INDEX ... USING hnsw ("embedding" vector_cosine_ops)'

-- 4. Document tiene los tres campos nuevos con defaults aplicados.
\d+ "Document"
-- esperado: columnas embeddingsProvider TEXT NOT NULL DEFAULT 'private-mac',
--           embeddingsModel TEXT NOT NULL DEFAULT 'nomic-embed-text',
--           embeddingsDim INTEGER NOT NULL DEFAULT 768.

-- 5. Índice de cobertura existe.
SELECT indexname FROM pg_indexes
WHERE tablename = 'Document'
  AND indexname = 'Document_embeddings_provider_idx';
-- esperado: 1 fila.
```

### Sección 5 — Verificar sin aplicar (introspect)

Si Codex tiene acceso al Railway:

```bash
railway run npx prisma migrate status --schema=packages/db/prisma/schema.prisma
```

**Esperado:** lista las 9 migraciones aplicadas previamente + la nueva
`20260608170000_embeddings_onprem_wipe_and_768d` como **pending**.

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `prisma generate` salida exacta (última línea).
- `npm test` salida exacta (resumen).
- `npm run lint` salida exacta.
- `tsc apps/api` salida exacta.

### Sección B — Diff sintáctico de schema.prisma

- Para `Chunk.embedding`: line del nuevo type, line del comentario que la
  documenta.
- Para `Document`: listado de los 3 campos nuevos.
- Confirmar que el índice `Document_embeddings_provider_idx` está
  declarado.

### Sección C — Migración SQL

- Listar las 5 secciones de la migración (con sus comentarios `--`) en
  orden.
- Confirmar que tiene `DELETE FROM "Chunk"; DELETE FROM "Document";`
  antes del DROP.
- Confirmar que el índice HNSW se llama `Chunk_embedding_hnsw_idx`
  (mismo nombre que el viejo) y usa `vector_cosine_ops`.

### Sección D — ADR-0018

- Existe en `docs/adr/`.
- Estado: Aceptado.
- Está enlazado en `docs/adr/README.md`.

### Sección E — ADR-0008

- Está marcado como Superseded.
- Apunta a `0018`.

### Sección F — Riesgos detectados (si hay alguno)

Cualquier cosa que el reporte automatizado no cuente pero que se note
manualmente al leer el código.

---

**Nota para Jorge:** este documento existe para que Codex pueda
verificar el trabajo de Claude Code (yo) y vice-versa. Si en el futuro
quieres cambiar el formato, edita este archivo — los próximos sub-PRs
seguirán el mismo patrón.
