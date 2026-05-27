# Runbook — desarrollo local

Esta guía describe **paso a paso** cómo levantar todo el stack en una
máquina nueva y cómo trabajar día a día. Si seguís el orden de abajo,
deberías llegar a tener el backend y el frontend corriendo en menos de
diez minutos.

> Pensado como el "manual del taller": qué herramienta sacar primero,
> en qué orden, qué hacer si algo no arranca. Cualquier paso que te
> haga adivinar es un bug del runbook — abrí un PR y arreglalo.

---

## 0) Prerrequisitos

| Herramienta    | Versión mínima   | Cómo verificar           |
| -------------- | ---------------- | ------------------------ |
| Node.js        | 20.x             | `node -v`                |
| npm            | (viene con Node) | `npm -v`                 |
| Docker Desktop | reciente         | `docker --version`       |
| Docker Compose | v2 (incluido)    | `docker compose version` |
| Git            | cualquier 2.x    | `git --version`          |

Opcional pero recomendado:

- [`gh`](https://cli.github.com/) (GitHub CLI) — para abrir PRs desde la terminal.
- Una IDE con soporte TypeScript decente (VS Code, WebStorm, etc.).

---

## 1) Primer arranque (una sola vez por máquina)

### 1.1 Clonar e instalar

```bash
git clone https://github.com/georgenton/ai-demo-platform.git
cd ai-demo-platform
npm ci
```

`npm ci` instala desde el `package-lock.json` (instalación
reproducible) y al final corre el hook `postinstall` que genera el
cliente de Prisma — esto es importante: sin el cliente generado el
typecheck falla.

### 1.2 Configurar variables de entorno

```bash
cp .env.example .env
```

El `.env` queda gitignored. Lo importante:

- **`DATABASE_URL`** — apunta a `localhost:5434` por defecto (ver paso 1.3).
- **`CHAT_API_KEY`** — clave de Anthropic. _Sin esto el chat no responde_,
  pero el resto del sistema (DB, ingest, embeddings) funciona igual.
- **`EMBEDDINGS_API_KEY`** — clave de OpenAI. _Sin esto el ingest no
  termina_ porque no puede vectorizar los chunks.

> **El server valida las env vars al boot.** Si `CHAT_API_KEY` o
> `EMBEDDINGS_API_KEY` están vacías, `nx serve api` falla con un error
> claro y el server no arranca. Para desarrollo sin keys reales, poné un
> placeholder no-vacío (ej. `sk-ant-placeholder`) como en `.env.example` —
> el server arranca, todo lo que no toque al LLM funciona (health, demos,
> documents/list, agent/history), y los endpoints que sí toquen al LLM
> fallarán al llamar al provider con un mensaje del provider real. Cuando
> tengas keys reales, las reemplazás y listo.

### 1.3 Levantar Postgres + pgvector

```bash
docker compose up -d
```

Esto levanta `pgvector/pgvector:pg17` en `localhost:5434` (sí, 5434, no
5432 — el puerto default lo solemos tener ocupado con otros proyectos
locales). Verificá que está sano:

```bash
docker compose ps
# postgres   running (healthy)
```

### 1.4 Aplicar migraciones

```bash
npm run db:migrate
```

Esto corre `prisma migrate dev`, que aplica todas las migraciones del
repo a tu base nueva. La primera vez también crea la extensión
`vector` (la pidió la migración inicial).

### 1.5 Smoke check rápido

```bash
npx nx serve api
```

Debería arrancar en `http://localhost:3000` y loggear que cargó
`IngestModule`, `ChatModule` y `DemosModule`. Probá:

```bash
curl http://localhost:3000/api/v1/demos
# [{"id":"rag","title":"Chat con documentos",...}, ...]
```

Si esto responde, la base está lista. Cortá el server (`Ctrl+C`) y
seguí al flujo diario.

---

## 2) Flujo diario de desarrollo

### 2.1 Servidores

Dos procesos en dos terminales:

| Comando                    | Qué levanta                      | Puerto |
| -------------------------- | -------------------------------- | ------ |
| `npx nx serve api`         | Backend NestJS (con auto-reload) | 3000   |
| `PORT=4200 npx nx dev web` | Frontend Next.js (con HMR)       | 4200   |

> El target del web es `dev` (no `serve`) porque `@nx/next` sigue la
> convención de Next.js: `next dev` para HMR, `next start` para prod.
> El `PORT=4200` es obligatorio — sin esto, Next intenta arrancar en
> 3000 (su default), choca con el backend y se va al 3001, lo que
> rompe los `rewrites()` que apuntan a `:3000`.

El frontend tiene `rewrites()` que proxea `/api/*` → el backend (ver
[ADR-0010](./adr/0010-web-api-coupling-rewrites-and-no-contracts-pkg.md)),
así que abrir `http://localhost:4200/demo/rag` te da la página con
todo conectado.

### 2.2 Postgres

Después del primer arranque, Postgres queda en el container. Comandos
útiles:

```bash
docker compose ps              # ¿está corriendo?
docker compose logs -f         # ver logs en vivo
docker compose down            # apagarlo (los datos persisten)
docker compose down -v         # apagarlo Y borrar todos los datos (reset)
npm run db:studio              # GUI web para inspeccionar la DB
```

### 2.3 Trabajar con la base

```bash
npm run db:migrate             # crear/aplicar nueva migración después de cambiar schema.prisma
npm run db:generate            # regenerar el cliente de Prisma sin tocar la DB
npm run db:seed                # popular la mini-DB académica del Demo 04 (determinístico)
npm run db:seed:demos          # cargar documentos sample para RAG/Comparator
                               # (requiere `nx serve api` + API keys reales)
```

Si la DB queda en un estado raro (drift, datos basura de un test
manual), el botón rojo es:

```bash
docker compose down -v && docker compose up -d && npm run db:migrate
```

Te devuelve una base limpia con todas las migraciones aplicadas.

---

## 3) Tests

```bash
npm test                       # tests unitarios (rápidos, con mocks)
npm test -- --watch            # modo watch para TDD
npm run test:integration       # tests de integración (levantan Postgres real vía testcontainers)
```

Los tests de integración **no usan tu container local** — `testcontainers`
levanta uno aparte por archivo de test, lo migra y lo apaga al
terminar. Son más lentos (30–90s la primera vez por el pull de la
imagen), por eso están separados del `npm test` default.

CI corre los dos (`npm test` + `npm run test:integration`). Antes de
pushear conviene correrlos en local.

---

## 4) Commits y PRs

- Branch por feature, nunca commit directo a `main` (la rama está
  protegida — el push fallaría igual).
- Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`,
  `chore`, …) — los enforce el hook de commitlint.
- Husky + lint-staged corren ESLint + Prettier sobre los archivos
  tocados antes de cada commit. Si fallan, fix → re-stage → commit.
- Después del push, abrí el PR (`gh pr create` o desde GitHub). CI
  corre lint + typecheck + unit + integration. Verde → merge.

Detalle completo: [`/CONTRIBUTING.md`](../CONTRIBUTING.md) +
[ADR-0007](./adr/0007-conventional-commits-and-pr-flow.md).

---

## 5) Troubleshooting

### `docker compose up` falla con "port 5434 already in use"

Otra cosa está usando el puerto. Opciones:

- Apagar lo que sea (puede ser un Postgres viejo: `lsof -i :5434`).
- Cambiar el puerto del host en `docker-compose.yml` (ej. `5435:5432`)
  y actualizar `DATABASE_URL` en `.env` y `.env.example`.

### `prisma migrate dev` se queja de drift

La DB tiene cambios que las migraciones no conocen (típico si hiciste
SQL manual o pegaste a la DB desde un test). El reset destructivo:

```bash
docker compose down -v && docker compose up -d && npm run db:migrate
```

> Si Prisma exige consentimiento por `migrate reset`, copiá el texto
> exacto que pide a la variable de entorno
> `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` para esa invocación.
> No es algo rutinario — si necesitás hacerlo seguido, hay algo que
> está mal en el workflow.

### Tests fallan con `Cannot find module '@org/db/...'`

El cliente de Prisma no se generó. Corré:

```bash
npm run db:generate
```

(o `npm ci` de nuevo, que dispara el `postinstall`).

### El frontend dice "Failed to fetch" desde `/demo/rag`

El backend no está arriba. Levantalo con `npx nx serve api` en otra
terminal. Las rewrites de Next solo proxean — si nadie escucha del
otro lado, fallan.

### El chat queda en `streaming` para siempre

Faltan API keys reales en `.env` (`CHAT_API_KEY` y/o
`EMBEDDINGS_API_KEY`), o están vacías. Sin keys el LLM no responde y
el `EventSource` queda colgado. Mirá los logs del backend
(`npx nx serve api`) — el error real está ahí.

### Husky / lint-staged falla y no me deja commitear

Es señal de que el código tiene errores de lint o formato. Corré:

```bash
npm run lint:fix
```

para que ESLint arregle lo que puede, después re-stage y re-commit.

---

## 6) Preparar una demo en vivo

Cuando vayas a presentar a un cliente, querés que la app **arranque ya
con contenido** — sin que tengas que subir archivos en vivo. Hay un
script que lo orquesta todo en un solo comando:

```bash
npm run demo:start
```

El script ejecuta los 6 pasos en orden, con health checks entre cada
uno y progreso visible:

1. Postgres + pgvector (docker compose)
2. Migraciones Prisma (`migrate deploy`)
3. Seed académico (50 estudiantes, ~1.700 grades para Demo 04)
4. Backend NestJS en background (espera `/health` 200)
5. Seed de documentos sample (3 RAG + 3 Comparator)
6. Frontend Next.js en background (espera primer paint)

Ctrl+C limpia backend y frontend; la DB queda arriba para la próxima
vez. Los logs separados van a `/tmp/demo-api.log` y `/tmp/demo-web.log`,
así la terminal principal solo muestra progreso.

**Flujo manual paso a paso** (si preferís controlar cada parte):

```bash
# 1. Stack arriba
docker compose up -d
npm run db:migrate:deploy

# 2. Seed académico (50 estudiantes, 10 cursos, 1.695 grades para Demo 04)
npm run db:seed

# 3. Backend en una terminal
npx nx serve api

# 4. Seed de documentos sample en OTRA terminal
#    (requiere que el backend ya esté arriba en la 3)
npm run db:seed:demos

# 5. Frontend en una tercera terminal
PORT=4200 npx nx dev web
```

Cuando abrás `http://localhost:4200`:

- **`/demo/rag`** ya tiene 3 documentos indexados (reglamento académico,
  manual de matrículas, política de propiedad intelectual). Las
  preguntas sugeridas tienen respuestas coherentes contra esos docs.
- **`/demo/comparator`** ya tiene 3 contratos para seleccionar.
- **`/demo/agent`** ya tiene la base académica seedeada para responder
  preguntas sobre estudiantes, materias, inscripciones.

El seed de demos es **idempotente** — si ya hay documentos con esos
nombres, los skipea. Podés correrlo varias veces sin duplicar.

---

## 7) Referencias rápidas

- Diseño general: [`architecture/`](./architecture/).
- Decisiones de diseño: [`adr/`](./adr/).
- Glosario (RAG, embeddings, pgvector, etc.): [`glossary.md`](./glossary.md).
- Contribución y branching: [`/CONTRIBUTING.md`](../CONTRIBUTING.md).
