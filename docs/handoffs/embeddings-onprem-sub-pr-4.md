# Handoff Codex — Sub-PR 4 (Embeddings on-prem · Runbook + cierre)

> **Cómo usar este documento.** Solo documentación, sin código de app.
> Léelo y devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Cuarto y último sub-PR del tren "Embeddings on-prem" (ADR-0018). **Solo
docs**:

- Actualiza `docs/runbook-deploy.md` con las env vars correctas
  post-ADR-0018 (private-mac + nomic-embed-text) y suma la sección 7
  "Migración a embeddings on-prem" con el playbook completo.
- Suma este handoff.

### Archivos tocados

| Archivo                                       | Cambio                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `docs/runbook-deploy.md`                      | Sección 0 (prerrequisitos) + 1.4 (env vars) + 4 (rotar key) actualizadas a private-mac. Sección 7 nueva: migración + smoke. |
| `docs/handoffs/embeddings-onprem-sub-pr-4.md` | Este documento.                                                                                                             |

### Lo que NO toca este sub-PR

- Código de aplicación (todo en sub-PRs 1-3).
- ADR-0018 (escrito en sub-PR 1).
- Migración SQL (en sub-PR 1).

## Cómo verificar el sub-PR

### Sección 1 — Compilación

```bash
cd ~/Projects_local/ai-demo-platform
npm test                                          # esperado: 421/421 verde (sin cambios)
npm run lint                                      # esperado: limpio
```

### Sección 2 — Lectura del runbook

Verifica que la sección 1.4 incluya el bloque private-mac completo:

- `CHAT_PROVIDER=private-mac`
- `EMBEDDINGS_PROVIDER=private-mac`
- `PRIVATE_LLM_BASE_URL` / `PRIVATE_LLM_API_KEY` / `PRIVATE_LLM_MODEL` /
  `PRIVATE_EMBEDDING_MODEL`
- Nota de fallback a `fake` para arrancar sin túnel.

Verifica que la sección 7 incluya:

- 7.1 Pre-flight SQL.
- 7.2 Env vars a verificar antes de mergear.
- 7.3 Mergeo del tren con descripción de qué hace la migración.
- 7.4 Tabla del smoke test con 10 filas.
- 7.5 SQL de verificación post-deploy.
- 7.6 Rollback.

### Sección 3 — Smoke test simulado (sin tocar Railway)

Si tienes acceso a una Postgres local con la migración aplicada:

```bash
# Aplica la migración:
DATABASE_URL=postgresql://... npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# Verifica el shape:
DATABASE_URL=postgresql://... npx prisma db pull --print | head -40
# Esperado: Chunk.embedding vector(768), Document.embeddingsProvider/Model/Dim.

# Arranca el server con fake:
CHAT_PROVIDER=fake EMBEDDINGS_PROVIDER=fake \
  DATABASE_URL=... JWT_SECRET=...32+chars... \
  npx nx serve @org/api
# Esperado: server up en :3000.
```

### Sección 4 — Sugerencias del smoke en producción

Cuando llegue el momento de aplicar a Railway:

1. Tomar backup manual de la DB de Railway.
2. Mergear el sub-PR 4.
3. Esperar redeploy automático.
4. Correr el smoke de la sección 7.4 — los 10 escenarios.
5. Verificar con SQL de la sección 7.5.

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación

- `npm test` salida (resumen).
- `npm run lint` salida.

### Sección B — Validación del runbook

- Sección 1.4 lista las 6 env vars del bloque private-mac y la fallback de
  fake.
- Sección 7 existe con subsecciones 7.1 → 7.6.
- Las queries SQL de 7.5 son sintácticamente válidas (no las ejecutes,
  solo léelas y confirma).

### Sección C — Riesgos detectados

Cualquier cosa que falte en el runbook, en particular:

- Pasos que asumen Railway CLI sin avisar.
- Variables que el adapter usa pero el runbook no menciona.
- Edge cases de la migración (rollback, downtime).

---

**Nota para Jorge:** este es el cierre del tren. Después del merge, el
demo RAG queda operativo en producción sujeto a que el túnel del Mac esté
vivo. Si el Mac está caído, todos los demos siguen funcionando con
`CHAT_PROVIDER=fake` o cambiando a Anthropic (los no-RAG).
