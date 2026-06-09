# Runbook — deploy a producción (Vercel + Railway)

Manual paso a paso para llevar la app a una URL pública con keys reales,
protegida con basic auth + shared secret. Pensado para que Jorge lo siga la
primera vez sin tener que pensar el orden.

> Resumen de la topología:
>
> ```
> Cliente (browser)
>   │ HTTPS + Basic auth
>   ▼
> Vercel (apps/web — Next.js)
>   │ middleware: basic auth
>   │ Route Handler proxy server-side
>   │ X-Internal-Key inyectado
>   ▼ HTTPS
> Railway (apps/api — NestJS)
>   │ InternalKeyGuard valida X-Internal-Key
>   │ Prisma migrate deploy al boot
>   ▼
> Railway Postgres + pgvector (add-on)
> ```

---

## 0) Prerrequisitos

- Cuenta en [Vercel](https://vercel.com) (web login, plan Hobby OK).
- Cuenta en [Railway](https://railway.app) (web login, trial $5 alcanza
  para el primer mes).
- Repo en GitHub al que ambas plataformas puedan acceder (push reciente).
- **Setup post-ADR-0018 (embeddings on-prem):**
  - Túnel HTTPS al gateway FastAPI del Mac (Cloudflare Tunnel típicamente)
    sirviendo `/v1/chat/completions` y `/v1/embeddings`. El gateway
    orquesta Ollama local con `qwen2.5:7b` para chat y `nomic-embed-text`
    para embeddings.
  - Una API key inventada para `PRIVATE_LLM_API_KEY` — el gateway no
    valida un proveedor cloud, pero el adapter requiere el header
    `Authorization: Bearer ...` por simetría OpenAI.
- API key de chat cloud opcional:
  - `CHAT_API_KEY` (Anthropic, prefix `sk-ant-`) — para el dropdown del
    header. El demo RAG queda bloqueado cuando Anthropic está activo
    (no fabrica embeddings), pero los otros 6 demos sí funcionan.

> Si no tienes alguna de las cuentas todavía, signup con GitHub (3 min).
>
> El setup inicial (provisionar servicios + env vars básicas) se hace por
> web. **Algunas operaciones puntuales requieren la Railway CLI**:
> seed inicial (`db:seed:tenants:railway`), verificación SQL post-migración
> (sección 7.1 / 7.5), re-sembrar después de un wipe. Instalala antes de
> empezar:
>
> ```bash
> npm i -g @railway/cli
> railway login
> ```

---

## 1) Provisionar el backend en Railway

### 1.1 Crear el proyecto

1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**
2. Seleccioná el repo `ai-demo-platform` → **Add variables later**
3. Railway detecta el `Dockerfile` y arranca un build. **No te asustes si
   el primer build falla** — todavía no configuramos env vars.

### 1.2 Agregar Postgres con pgvector

1. En el proyecto Railway → **+ New** → **Database** → **Add PostgreSQL**.
2. Esperá ~30s a que provisione. Railway expone `DATABASE_URL` automático.
3. **Activar pgvector**: andá al servicio Postgres → tab **Data** →
   **Query** → ejecutá:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   Sin esto, la primera migración del backend falla con "type vector does
   not exist".

### 1.3 Conectar la DB al servicio del backend

1. En el servicio del backend → **Variables** → **Add Reference** →
   seleccioná el servicio Postgres → variable `DATABASE_URL`. Railway crea
   la referencia (auto-renueva si la DB rota credenciales).

### 1.4 Setear el resto de env vars

En el servicio del backend → **Variables** → **+ New variable**, una por una:

```
# --- LLM chat (default singleton del env; el dropdown del header puede
# override por request con X-LLM-Provider). El demo arranca con private-mac
# por defecto — el message comercial es Nutanix on-prem (ver ADR-0018).
CHAT_PROVIDER=private-mac
CHAT_MODEL=claude-sonnet-4-5    # ignorado por private-mac; queda como fallback
# CHAT_API_KEY=sk-ant-...        # solo necesaria si CHAT_PROVIDER=anthropic
                                  # o si el dropdown se cambia a Anthropic.

# --- Embeddings on-prem (ADR-0018). Anthropic NO fabrica embeddings; el
# demo RAG queda bloqueado en backend (400) cuando el dropdown está en
# Anthropic. NAI on-prem sirve nomic-embed-text (768 dimensiones).
EMBEDDINGS_PROVIDER=private-mac
EMBEDDINGS_MODEL=text-embedding-3-small  # ignorado por private-mac, fallback
# EMBEDDINGS_API_KEY=...                  # opcional bajo private-mac

# --- Conexión al gateway del Mac (sirve chat + embeddings vía API
# OpenAI-compatible). Las cuatro PRIVATE_* siguientes son OBLIGATORIAS
# cuando CHAT_PROVIDER o EMBEDDINGS_PROVIDER son private-mac:
PRIVATE_LLM_BASE_URL=https://private-llm.<tu-tunel>.com
PRIVATE_LLM_API_KEY=<key-inventada-bearer>
PRIVATE_LLM_MODEL=qwen2.5:7b             # chat
PRIVATE_EMBEDDING_MODEL=nomic-embed-text # embeddings
PRIVATE_LLM_DEMO_NAME=demo-bank          # opcional, default 'demo-bank'
PRIVATE_LLM_TIMEOUT_MS=120000            # opcional, default 120s

# Genera un secreto random largo (32+ chars). Ejemplo en local:
#   openssl rand -hex 32
INTERNAL_API_KEY=<genera-uno-y-guardalo>

# --- Auth multi-tenant (obligatorio post sprint MT1, PR #71). Sin esto el
# server crashea al boot con: "JWT_SECRET debe tener al menos 32 caracteres".
# Genera con `openssl rand -base64 48`.
JWT_SECRET=<genera-uno-y-guardalo>

# --- Opcionales del sprint multi-tenant (default seguros si los omites)
JWT_EXPIRES_IN=7d                                    # default 7d
COOKIE_DOMAIN=                                       # solo si frontend+backend comparten dominio
SUPERADMIN_EMAILS=                                   # ej: jorge@nai.local,edguitar@nai.local
```

> **Si el túnel del Mac no está listo todavía** y quieres arrancar el server
> para verificar el shell, puedes setear `CHAT_PROVIDER=fake` +
> `EMBEDDINGS_PROVIDER=fake` (sin keys, sin modelos, sin túnel). El adapter
> fake devuelve respuestas determinísticas y vectores bag-of-words — útil
> para CI y para validar el shell sin red. Cuando el túnel esté operativo,
> cambia las dos vars a `private-mac` y redeploy.

> **Post sprint multi-tenant — paso obligatorio extra:** una vez que el
> backend arranque (Deployment live), corre el seed que crea el
> superadmin inicial:
>
> ```bash
> railway link  # solo la primera vez
> npm run db:seed:tenants:railway
> ```
>
> El script `db:seed:tenants:railway` usa `DATABASE_PUBLIC_URL` (la URL
> externa que expone Railway) para que el seed corra desde tu máquina
> local. Si usaras `db:seed:tenants` plano, intentaría conectarse a
> `postgres.railway.internal` — la URL interna sólo accesible desde dentro
> del runtime de Railway.
>
> Esto crea `admin@nai.local` con contraseña `demo-platform-2026` —
> **cámbiala en el primer login**. El tenant `demo` y la industry
> `universidad` ya los crea automáticamente la migración
> `add_tenant_id_to_existing_tables` (idempotente).

> **Guardá ese `INTERNAL_API_KEY`** — el mismo valor exacto lo vas a poner
> en Vercel en el paso 2.5.

### 1.5 Re-deploy y verificar

1. **Deployments** → **Redeploy** (con las env vars ya cargadas).
2. Esperá a que el build pase (~3-5 min la primera vez).
3. Cuando esté **Deployment live**, andá a **Settings** → **Networking**
   → **Generate Domain**. Vas a obtener algo como
   `ai-demo-platform-production.up.railway.app`.
4. **Smoke**:

   ```bash
   # Health: debe responder sin necesidad de la key
   curl https://<tu-railway-domain>/api/v1/health
   # Esperado: {"status":"ok",...}

   # Demos sin key: debe ser 401
   curl -o /dev/null -w "%{http_code}\n" https://<tu-railway-domain>/api/v1/demos
   # Esperado: 401

   # Demos con key: debe ser 200
   curl -H "X-Internal-Key: <tu-INTERNAL_API_KEY>" https://<tu-railway-domain>/api/v1/demos
   # Esperado: [{"id":"rag",...}]
   ```

Si los 3 pasan, **el backend está listo**. Anotá el dominio para el paso 2.

---

## 2) Provisionar el frontend en Vercel

### 2.1 Importar el repo

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   `ai-demo-platform`.
2. Antes de hacer **Deploy**, configurá:

### 2.2 Configuración de build (monorepo Nx)

- **Framework Preset**: Next.js (Vercel lo detecta solo).
- **Root Directory**: `apps/web`. **Importante**: marcá
  **"Include source files outside of the Root Directory"** — Vercel
  necesita el lockfile y los `packages/*` del root del monorepo.
- **Build Command**: dejá el default (`next build`). El plugin `@nx/next`
  se encarga.
- **Install Command**: `cd ../.. && npm ci` — instala desde el root, no
  desde `apps/web`.
- **Output Directory**: dejá el default (`.next`).

### 2.3 Setear env vars

En **Environment Variables**:

```
# URL del backend en Railway (de 1.5)
BACKEND_URL=https://<tu-railway-domain>

# Mismo valor exacto que el backend (de 1.4)
INTERNAL_API_KEY=<el-mismo-de-Railway>
```

> **Histórico — basic auth retirado**: antes del sprint multi-tenant la
> app también pedía credenciales HTTP Basic Auth a nivel deploy
> (`BASIC_AUTH_USER` + `BASIC_AUTH_PASSWORD`). Con el login real de
> aplicación esa capa ya no aporta protección y solo agregaba un alert
> molesto antes de llegar a `/login`. Si tu deploy todavía las tiene
> seteadas, podés borrarlas — el middleware ya no las consume.

> Importante: **no setear `BACKEND_URL` ni `INTERNAL_API_KEY` como
> `NEXT_PUBLIC_*`**. Solo se usan server-side en el Route Handler — si
> tuvieran el prefijo `NEXT_PUBLIC_`, irían al bundle del cliente y el
> secreto se filtraría.

### 2.4 Deploy

1. **Deploy**. El primer build tarda ~2-3 min.
2. Vercel te asigna un dominio `<project>.vercel.app`.

### 2.5 Smoke E2E

Abrí `https://<vercel-domain>` en una pestaña en incógnito:

1. La app te redirige a `/login` (middleware: sin cookie auth → login).
2. Loguea con `admin@nai.local` / la contraseña del seed-tenants. Aterrizás
   en el dashboard con las cards de los demos habilitados.
3. Navegá a `/demo/rag`. Hacé una pregunta sugerida ("¿Cuál es el horario
   de matrícula?"). Si el streaming arranca → **la cadena completa funciona**.
4. Si el chat queda colgado en "streaming":
   - Verificá en Vercel **Logs** → buscá errores del proxy route.
   - Verificá en Railway **Logs** → buscá si el backend rechazó la request
     (401 sería desincronía del `INTERNAL_API_KEY` entre ambos lados).

---

## 3) Cargar los documentos sample

El deploy levanta la app **sin documentos** indexados. Para que la demo
tenga contenido pre-cargado, hay que correr el seed contra el backend
de producción **una sola vez**:

```bash
# Desde tu máquina local, apuntando al backend de Railway:
INGEST_API_BASE=https://<tu-railway-domain>/api/v1 \
INTERNAL_API_KEY=<el-mismo-secreto> \
npm run db:seed:demos
```

> El script `seed-demos` actualmente apunta a `localhost:3000` por default.
> Si querés que respete `INGEST_API_BASE` y mande `X-Internal-Key`, hay un
> TODO en `packages/db/prisma/seed-demos.ts`. Si lo querés sin tocar
> código, abrí port-forward local + agregá `--header X-Internal-Key`
> manualmente al curl. Lo simple: subí los 6 PDFs vía UI desde la demo
> autenticada (`/demo/rag` upload + `/demo/comparator` upload).

El seed académico (Demo 04) corre automático en cada arranque del
backend — el `CMD` del Dockerfile encadena `migrate deploy` + `tsx
seed.ts` + `node main.js`, así que cuando Railway termina de
deployar ya hay 50 estudiantes, 10 cursos y ~1700 grades listos en la
DB. Es idempotente (PRNG seedeado), así que cada deploy regenera
exactamente los mismos datos.

Si necesitas re-sembrar manualmente sin re-deployar (ej. después de
limpiar la DB a mano):

```bash
# Requiere `railway login` + `railway link` una sola vez.
npm run db:seed:railway
```

El script resuelve `DATABASE_URL ← DATABASE_PUBLIC_URL` cuando existe,
porque la URL interna (`postgres.railway.internal`) solo funciona
dentro del contenedor.

---

## 4) Operación durante la demo

### Compartir credenciales

Post sprint multi-tenant (PR-MT1+) la app usa login real con email +
contraseña. Cada presentador o cliente recibe credenciales separadas:

- A **Edguitar** (o cualquier presentador): URL + email de superadmin
  (`admin@nai.local` por default del seed) + contraseña inicial. **El
  primer login debe cambiarla** desde el panel de usuario.
- A un **cliente puntual** después de la reunión: crear un usuario
  dedicado en el panel admin → asignarlo al tenant de prueba → enviarle
  email + contraseña temporal. Al terminar el demo, desactivar el
  usuario desde el panel.

### Rotar contraseña del superadmin

1. Login con la cuenta actual.
2. Panel de usuario (avatar arriba a la derecha) → **Cambiar contraseña**.
3. Las sesiones activas en otros browsers siguen funcionando hasta que
   expire el JWT (default 7 días, configurable con `JWT_EXPIRES_IN`).
   Para invalidación inmediata, rotar `JWT_SECRET` en Railway —
   invalida TODOS los tokens emitidos.

### Ver logs en vivo

- **Backend (Railway)**: Project → servicio → **Deployments** → el activo
  → **View Logs**. Streaming.
- **Frontend (Vercel)**: Project → **Logs** (tab). Streaming. Filtrá por
  `/api/...` para ver solo lo que pasa por el proxy.

### Si una key se quema

- Anthropic (solo afecta cuando el dropdown está en Anthropic): dashboard
  → rotate key. Pega el nuevo valor en Railway → Variables → `CHAT_API_KEY`
  → save → Railway redeploya automático.
- NAI on-prem (PRIVATE_LLM): rotar `PRIVATE_LLM_API_KEY` en el gateway
  del Mac + en Railway. Como es bearer simulado, basta con coordinar el
  cambio.

---

## 5) Costos esperados

| Concepto          | Costo                                                          |
| ----------------- | -------------------------------------------------------------- |
| Vercel Hobby      | $0 (mientras no se agoten 100GB-hr de Functions/mes)           |
| Railway backend   | ~$5/mes después del trial ($5 free credit cubre el primer mes) |
| Railway Postgres  | incluido en el plan                                            |
| Anthropic         | pay-per-token. Una pregunta del demo ≈ $0.001–0.005            |
| OpenAI embeddings | pay-per-token. Indexar un PDF de 10 páginas ≈ $0.001           |

**Estimado conservador para una semana de demos a clientes**: < $10 total.

---

## 6) Troubleshooting

### "Authentication required" todo el tiempo

Las credenciales de basic auth no coinciden con `BASIC_AUTH_USER` /
`BASIC_AUTH_PASSWORD` en Vercel. Chequeá que no tengan espacios al final
en la consola de Vercel — un trailing space rompe sin warning.

### El chat queda colgado en "streaming"

Tres causas comunes, en orden de probabilidad:

1. `INTERNAL_API_KEY` en Vercel ≠ Railway. Verificalas char-a-char.
2. `BACKEND_URL` en Vercel apunta a una URL vieja (re-domain de Railway).
3. La key de Anthropic/OpenAI se quemó o expiró. Revisá los logs de
   Railway (debería aparecer 401 del provider).

### Migraciones fallan al boot del backend

`migrate deploy` espera la DB lista. Si Railway todavía está provisionando
Postgres cuando arranca el backend, falla con "connection refused". Espera
~30s y dispara un re-deploy manual.

### "type vector does not exist"

Te olvidaste de correr `CREATE EXTENSION vector;` (paso 1.2). Repetilo
contra la DB de Railway y re-deployá.

---

## 7) Migración a embeddings on-prem (ADR-0018)

Este playbook se aplica **una sola vez** en Railway cuando se mergea el
tren del sub-PR 1-4 (ADR-0018). Si llegas a Railway con la migración
`20260608170000_embeddings_onprem_wipe_and_768d` pendiente, sigue estos
pasos en orden. Si ya está aplicada (Railway corre `prisma migrate deploy`
al boot), pasa a la sección 7.4 — smoke test.

### 7.1 Pre-flight check (antes de mergear)

```bash
# Verificar el estado actual de la base en Railway.
railway run psql -c "SELECT DISTINCT vector_dims(embedding) FROM \"Chunk\" WHERE embedding IS NOT NULL;"
# Esperado: una sola fila con 1536 (OpenAI text-embedding-3-small).
# Si hay valores distintos a 1536, AVISA antes de seguir — la migración
# asume que todo lo viejo es 1536.

railway run psql -c "SELECT COUNT(*) FROM \"Chunk\";"
# Anota el número. La migración lo va a borrar todo (wipe acordado).

railway run psql -c "SELECT COUNT(*) FROM \"Document\";"
# Idem.
```

### 7.2 Configurar las env vars nuevas

Antes de mergear el tren, asegúrate de que Railway tenga los dos switches
de provider en `private-mac` Y las cuatro `PRIVATE_LLM_*` (ver sección
1.4). Sin alguna, el server arranca pero el primer ingest/chat con
`EMBEDDINGS_PROVIDER=private-mac` falla con "PRIVATE_LLM_BASE_URL es
obligatoria…" o equivalente.

```bash
# Verifica los dos switches de provider:
railway variables get CHAT_PROVIDER          # esperado: private-mac
railway variables get EMBEDDINGS_PROVIDER    # esperado: private-mac

# Verifica las cuatro PRIVATE_LLM_*:
railway variables get PRIVATE_LLM_BASE_URL   # esperado: https://...
railway variables get PRIVATE_LLM_API_KEY    # esperado: <bearer>
railway variables get PRIVATE_LLM_MODEL      # esperado: qwen2.5:7b (o el que esté servido)
railway variables get PRIVATE_EMBEDDING_MODEL # esperado: nomic-embed-text
```

### 7.3 Mergear el tren (sub-PR 1-4)

Mergea los 4 PRs en orden (#93 → #96 → #97 → este). Railway redeploya
automático cuando el último cae en main:

1. **Migración aplicada**: `prisma migrate deploy` corre en el boot del
   container y aplica la migración nueva, borrando los 660 chunks +
   11 documents existentes, recreando la columna `embedding vector(768)`,
   sumando los 3 campos de metadata a `Document` y los índices HNSW.
2. **Server arranca**: el adapter de embeddings ahora usa private-mac
   por default. Los servicios cargan el dropdown del header en cada
   request.

### 7.4 Smoke test post-deploy

Con la app pública en Vercel y el dropdown del header visible:

| #   | Acción                                                                                                            | Esperado                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Login con `admin@nai.local`                                                                                       | Dashboard cargado, dropdown del header amarillo "Elige modelo"                                             |
| 2   | Click en dropdown → elegir "NAI on-prem"                                                                          | Banner amarillo desaparece, label pasa a "NAI on-prem"                                                     |
| 3   | Visitar `/demo/rag` con NAI activo                                                                                | Sin banner. Botón "Subir documento" habilitado. Composer activo                                            |
| 4   | Subir un PDF chico (`< 1 MB`)                                                                                     | 201 Created. El doc aparece en el sidebar                                                                  |
| 5   | Preguntar "¿de qué trata este documento?"                                                                         | Streaming de tokens. Cita el fragmento del PDF                                                             |
| 6   | Cambiar dropdown a "Anthropic API"                                                                                | Badge "sin RAG" visible en la opción Anthropic. Banner naranja en `/demo/rag`                              |
| 7   | En `/demo/rag` con Anthropic activo                                                                               | Banner "Este demo necesita NAI on-prem" + botón "Cambiar a NAI on-prem". Composer y "Subir" deshabilitados |
| 8   | Click "Cambiar a NAI on-prem" del banner                                                                          | Provider cambia, banner desaparece, controles vuelven                                                      |
| 9   | Visitar `/demo/agent` con Anthropic activo                                                                        | Demo agent funcional (chat puro, sin RAG) — los demos no-RAG funcionan con ambos providers                 |
| 10  | Misma prueba en `/demo/tutor`, `/demo/comparator`, `/demo/clinical`, `/demo/interview`, `/demo/corpus` (búsqueda) | Los 6 demos no-RAG funcionan con Anthropic; el corpus upload queda bloqueado por banner                    |

### 7.5 Verificación SQL post-deploy

```bash
railway run psql -c "
SELECT COUNT(*) FROM \"Chunk\";                                     -- esperado: > 0 (los del paso 4)
SELECT DISTINCT vector_dims(embedding) FROM \"Chunk\";              -- esperado: 768
SELECT \"embeddingsProvider\", \"embeddingsModel\", \"embeddingsDim\",
       COUNT(*) FROM \"Document\" GROUP BY 1,2,3;
-- esperado: private-mac / nomic-embed-text / 768 / N
"
```

### 7.6 Rollback de emergencia

Si el demo falla post-migración y necesitas volver atrás:

1. **No** correr la migración inversa (la data borrada no se recupera).
2. Restaurar desde el último backup de Railway anterior a 2026-06-09.
3. Revertir los cuatro PRs en main (sin reabrir): `git revert e9c030a..HEAD`.
4. Railway redeploya con el código viejo (vector(1536) + sin switch).

Mejor preventivo: tomar un backup manual de Railway justo antes del paso
7.3 (Railway dashboard → DB → Backups → Create backup).

---

## Referencias

- Diseño general: [`architecture/`](./architecture/)
- ADR del LLMAdapter: [`adr/0004-llm-adapter-pattern.md`](./adr/0004-llm-adapter-pattern.md)
- ADR del switch dinámico de embeddings: [`adr/0018-embeddings-on-prem.md`](./adr/0018-embeddings-on-prem.md)
- Handoffs del tren ADR-0018:
  - [`handoffs/embeddings-onprem-sub-pr-1.md`](./handoffs/embeddings-onprem-sub-pr-1.md) — schema
  - [`handoffs/embeddings-onprem-sub-pr-2.md`](./handoffs/embeddings-onprem-sub-pr-2.md) — backend
  - [`handoffs/embeddings-onprem-sub-pr-3.md`](./handoffs/embeddings-onprem-sub-pr-3.md) — frontend
- Cómo arrancar todo en local: [`runbook-local.md`](./runbook-local.md)
- Guion de demo: [`demo-script.md`](./demo-script.md)
