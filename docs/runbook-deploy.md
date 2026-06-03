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
- Las dos API keys reales:
  - `CHAT_API_KEY` (Anthropic, prefix `sk-ant-`)
  - `EMBEDDINGS_API_KEY` (OpenAI, prefix `sk-proj-`)

> Si no tenés alguna de las dos cuentas todavía, signup con GitHub (3 min).
> No hace falta instalar CLIs — todo se hace por web.

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
CHAT_PROVIDER=anthropic
CHAT_API_KEY=sk-ant-<la-tuya>
CHAT_MODEL=claude-sonnet-4-20250514

EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_API_KEY=sk-proj-<la-tuya>
EMBEDDINGS_MODEL=text-embedding-3-small

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

> **Post sprint multi-tenant — paso obligatorio extra:** una vez que el
> backend arranque (Deployment live), corre el seed que crea el
> superadmin inicial:
>
> ```bash
> railway link  # solo la primera vez
> railway run npm run db:seed:tenants
> ```
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

# Basic auth — elegí user/pass. Vas a compartir estas credenciales con
# Edguitar y con clientes específicos para la demo.
BASIC_AUTH_USER=demo
BASIC_AUTH_PASSWORD=<elegí-uno>
```

> Importante: **no setear `BACKEND_URL` ni `INTERNAL_API_KEY` como
> `NEXT_PUBLIC_*`**. Solo se usan server-side en el Route Handler — si
> tuvieran el prefijo `NEXT_PUBLIC_`, irían al bundle del cliente y el
> secreto se filtraría.

### 2.4 Deploy

1. **Deploy**. El primer build tarda ~2-3 min.
2. Vercel te asigna un dominio `<project>.vercel.app`.

### 2.5 Smoke E2E

Abrí `https://<vercel-domain>` en una pestaña en incógnito:

1. **Sin credenciales**: el browser muestra el prompt nativo de basic auth.
2. **Con `demo` / `<tu-pass>`**: entrás a la landing.
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

- A **Edguitar** (o cualquier presentador): URL + `BASIC_AUTH_USER` y
  `BASIC_AUTH_PASSWORD`.
- A un **cliente puntual** después de la reunión: la misma cosa, pero
  considerar rotar el password cada N clientes para invalidar accesos
  viejos.

### Rotar el basic auth

1. Vercel → Project → **Settings** → **Environment Variables** → editá
   `BASIC_AUTH_PASSWORD`.
2. **Redeploy** (Vercel → Deployments → ⋯ del último → Redeploy).
3. Las sesiones cacheadas en browsers que ya estaban autenticadas
   **siguen funcionando** hasta cerrar el browser — el basic auth lo
   cachea el cliente, no el server. Para invalidación inmediata, cambiá
   también `BASIC_AUTH_USER`.

### Ver logs en vivo

- **Backend (Railway)**: Project → servicio → **Deployments** → el activo
  → **View Logs**. Streaming.
- **Frontend (Vercel)**: Project → **Logs** (tab). Streaming. Filtrá por
  `/api/...` para ver solo lo que pasa por el proxy.

### Si una key se quema

- Anthropic: dashboard → rotate key. Pegá el nuevo valor en Railway →
  Variables → `CHAT_API_KEY` → save → Railway redeploya automático.
- OpenAI: idem con `EMBEDDINGS_API_KEY`.

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

## Referencias

- Diseño general: [`architecture/`](./architecture/)
- ADR de la arquitectura del LLMAdapter: [`adr/0004-llm-adapter-pattern.md`](./adr/0004-llm-adapter-pattern.md)
- Cómo arrancar todo en local: [`runbook-local.md`](./runbook-local.md)
- Guion de demo: [`demo-script.md`](./demo-script.md)
