# Glosario

Términos clave del proyecto en lenguaje simple. Pensado especialmente para
quien viene de otro stack y se está acercando a IA / RAG por primera vez.

> Convención: cada término tiene una **definición breve** y, cuando suma,
> una **analogía** o un **ejemplo concreto** del proyecto.

---

## IA y LLMs

### LLM (Large Language Model)

Modelo de lenguaje grande. Una IA entrenada con muchísimo texto que aprende a
predecir qué palabra viene después. De ahí salen las capacidades de resumir,
traducir, responder, etc. Ejemplos: Claude (Anthropic), GPT-4 (OpenAI),
Llama (Meta).

### Token

La unidad básica que procesa un LLM — usualmente una palabra o un trozo de
palabra. _"Hola mundo"_ son aproximadamente 3 tokens. Los LLMs cobran por
token y tienen un máximo por pedido (**context window**).

### Context window

El máximo de tokens que un LLM puede leer + escribir en un mismo pedido. Si
querés que "lea" un PDF de 50 páginas, posiblemente no entre completo — de
ahí la necesidad de RAG.

### Prompt

El texto que le mandás al LLM. Suele tener varias partes: _system prompt_
(instrucciones generales), _user prompt_ (lo que el usuario pide), y a veces
contexto adicional (los fragmentos del RAG).

### System prompt

La instrucción de base que el LLM recibe antes de cualquier pregunta del
usuario. Ej: _"Sos un asistente que responde solo con información del
documento que se te pasó. Cita el fragmento exacto."_

### Streaming (SSE)

Hacer que el LLM devuelva tokens de a uno (en vivo) en lugar de esperar a
tener la respuesta completa. La experiencia "los tokens van apareciendo" es
parte del impacto de la demo. Lo implementamos con **Server-Sent Events**
(SSE), un protocolo HTTP simple para envío unidireccional desde el server al
cliente.

---

## RAG (Retrieval-Augmented Generation)

### RAG

Patrón donde **primero buscás información relevante** en tu propia data, y
**luego se la mandás al LLM como contexto** para que responda. Es lo que
permite "chatear con tu PDF": el LLM no conoce tu documento, pero le pasás
los pedacitos relevantes junto con la pregunta.

### Chunk

Un **fragmento** de un documento, lo suficientemente chico para entrar al
context window del LLM con el resto del prompt. Para un PDF de 100 páginas
podemos tener 500 chunks.

### Chunking

La estrategia de **cortar** un documento en chunks. Hay variantes: por
párrafo, por número fijo de tokens, ventana deslizante con solapamiento, etc.
Cada estrategia tiene trade-offs entre cobertura, contexto y volumen.

### Embedding

Una **representación numérica del significado** de un texto. Es una lista
larga de números (un _vector_) que se puede comparar matemáticamente con
otros embeddings. Dos textos con significado parecido tienen vectores
parecidos — esa es la magia.

Ejemplo: _"el reglamento dice que…"_ y _"según las normas…"_ generan
embeddings parecidos aunque las palabras no se parezcan.

### Vector

Una lista de números, generalmente de tamaño fijo (ej. 768, 1024 o 1536). En
este proyecto cada chunk se convierte en un vector de **768 dimensiones**
(modelo `nomic-embed-text` servido por NAI on-prem) y se guarda en Postgres
con pgvector. Ver [`ADR-0018`](./adr/0018-embeddings-on-prem.md).

### Similitud (coseno)

La fórmula que mide qué tan parecido es el significado de dos textos. Da un
número entre 0 (nada parecido) y 1 (idénticos). Es lo que pgvector calcula
rápido para encontrar los chunks más relevantes a una pregunta.

### pgvector

Una **extensión de PostgreSQL** que agrega un tipo de columna `vector(N)` y
operadores de búsqueda por similitud (`<->`, `<=>`). Permite hacer RAG sin
sumar una base vectorial dedicada (Pinecone, Qdrant, etc.).

### Retriever

El componente que, dada una pregunta, **encuentra los chunks más relevantes**
en la base vectorial. En nuestro stack es código en `packages/rag-core` que
embebe la pregunta y consulta pgvector.

---

## Patrones de código

### Adapter pattern

Un patrón de diseño donde **una única "puerta"** (la interface adapter)
abstrae varias implementaciones detrás. En este proyecto, `LLMAdapter` es esa
puerta: adentro hoy llama a Anthropic, mañana llama a NAI, **y el código de
negocio no se entera**.

### Inyección de dependencias (DI)

Patrón donde las dependencias de una clase (otros servicios que necesita) se
le **entregan listas** en lugar de que ella misma las cree (`new ...`). Es el
corazón de NestJS: en vez de `const service = new MyService()`, declarás
`constructor(private service: MyService)` y el framework lo conecta.

### Singleton

Una sola instancia de algo, compartida por toda la app. Usamos singleton para
el cliente de Prisma — si no, cada hot-reload abriría un pool de conexiones
nuevo y se agotaría Postgres.

### ORM (Object-Relational Mapper)

Una capa que te deja hablar con la base de datos en términos de **objetos del
lenguaje** en lugar de SQL crudo. Acá usamos Prisma: en vez de
`SELECT * FROM "Document" WHERE id = $1`, escribís
`prisma.document.findUnique({ where: { id } })` y obtenés un objeto tipado.

### Migration

Un **archivo SQL versionado** que registra un cambio en el esquema de la base
(crear tabla, agregar columna, etc.). Aplicar las migraciones en orden lleva
a la base a un estado conocido. Las gestiona Prisma.

---

## Estructura del monorepo

### Monorepo

Un **único repositorio git** que contiene varios proyectos relacionados
(apps + librerías compartidas). Comparten configuración, dependencias y
tooling.

### Workspace

Un paquete dentro del monorepo. Acá tenemos workspaces en `apps/*` y
`packages/*`. Cada workspace tiene su propio `package.json`.

### Nx

Herramienta que administra el monorepo: corre tareas (`nx serve`,
`nx build`…) por proyecto, cachea entre corridas, y sabe qué proyectos
dependen de cuáles. Es el "administrador del edificio".

### App vs Package

- **App** (`apps/`): cosa que **se ejecuta y se despliega** — un producto
  final. Ej: `apps/api`, `apps/web`.
- **Package** (`packages/`): librería **compartida** que las apps consumen,
  pero no se despliega sola. Ej: `packages/db`, `packages/llm-adapter`.

---

## Infraestructura

### Nutanix Enterprise AI (NAI)

La plataforma on-premise donde corren los LLMs en producción. Expone una API
compatible con OpenAI, así que el mismo código que en dev habla con Anthropic
en prod habla con NAI cambiando variables de entorno.

### NIM (NVIDIA Inference Microservice)

El motor que sirve los modelos dentro de NAI. Funciona como un contenedor que
expone una API REST para inferencia y embeddings.

### Docker Compose

Herramienta para describir y levantar **varios contenedores juntos** desde un
archivo `docker-compose.yml`. Hoy lo usamos solo para Postgres + pgvector;
mañana sumaría Redis, el `ai-service` de Python, etc.

---

## Flujo profesional

### Conventional Commits

Convención de formato para los mensajes de commit:
`<tipo>: <descripción>`. Tipos: `feat`, `fix`, `chore`, `docs`, etc.
Lo valida `commitlint` automáticamente en cada commit. Detalle en
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

### Changeset

Un **archivo markdown** que describe qué cambia un PR y qué tan grande es el
cambio (`patch` / `minor` / `major`). Cuando se cierra una versión, el CLI
de changesets junta los archivos pendientes, sube los números y arma el
CHANGELOG automáticamente.

### ADR (Architecture Decision Record)

Un archivo corto que captura **una** decisión técnica: el contexto, lo que se
decidió, las alternativas consideradas y las consecuencias. Vive en
[`docs/adr/`](./adr/). Es la "memoria histórica" del proyecto.

---

## Multi-tenant SaaS

### Tenant

Una **organización cliente** dentro de la plataforma SaaS. Cada
universidad, banco o estudio jurídico que usa el producto es un tenant
con sus propios usuarios, documentos y configuración. La unidad
mínima de aislamiento de datos — todas las queries del backend filtran
por `tenantId`. Definido en [ADR-0013](./adr/0013-multi-tenant-saas-architecture.md).

### Industry

Una **vertical de mercado**: `universidad`, `banca`, `legal`, `salud`,
`gobierno`, `retail`. Es una tabla pequeña (~6 filas) que define
**defaults** para los tenants de esa industria: qué demos están
habilitados por default, qué copy va en el welcome, etc. Cada tenant
pertenece a UNA industry y hereda sus defaults salvo que los
overridee.

### `enabledDemos`

Lista de **IDs de demos habilitados** para un tenant. La regla de
herencia es simple: si `Tenant.enabledDemos = []`, hereda de
`Industry.enabledDemos`; si tiene valores, **pisa** la default (no es
merge). Implementado en `IndustryService.resolveEnabledDemos()`.

### `branding`

Objeto JSON en `Tenant.branding` con campos opcionales `logoUrl`,
`accentColor`, `displayName`. El frontend lee defensive (cualquier
campo corrupto se ignora con fallback al ui-kit). El accent color se
inyecta como CSS var solo en el sidebar — no contamina el resto de la
app.

### Soft tenancy

Modelo de multi-tenancy donde **una sola DB** sirve a todos los
tenants, con una columna `tenantId` en cada tabla que escribe datos
del cliente. Opuesto a "hard tenancy" (DB por cliente). Más simple
operacionalmente, requiere disciplina de filtrar `tenantId` en toda
query — patrón que enforce-amos con el `TenantGuard` global.

### `TenantGuard`

Guard de NestJS que corre después del `AuthGuard` y pone
`request.tenantId` desde el JWT (campo `tid`). Garantiza que el
backend nunca acepta un `tenantId` del query string o body — solo del
token firmado. Superadmin puede sobreescribirlo con `?tenantId=` con
logging.

### `DemoAccessGuard` + `@RequireDemo()`

Guard global (opt-in) que rechaza con 403 si el tenant del usuario no
tiene el demo habilitado. Los controllers anotan
`@RequireDemo('comparator')` (estático) o
`@RequireDemo({ from: 'query', key: 'demoId' })` (dinámico). El guard
solo consulta la DB cuando el handler marcó el decorator.

### `RolesGuard` + `@RequireRole()`

Guard global (opt-in) con jerarquía `superadmin > admin > member`.
`@RequireRole('admin')` deja pasar admin Y superadmin. Defensa en
profundidad para endpoints administrativos como `/api/v1/admin/tenant`.

### JWT en cookie httpOnly

Estrategia de auth elegida en
[ADR-0014](./adr/0014-auth-email-password-jwt.md). El token JWT vive
en una cookie httpOnly + SameSite=Strict — el browser la envía
automáticamente en todas las requests al mismo origen, pero JavaScript
no la puede leer (mitigación de XSS).

### Migración en 3 pasos (NOT NULL backfill)

Patrón para agregar una columna NOT NULL a una tabla con datos
existentes sin downtime: (1) `ADD COLUMN nullable`, (2) backfillear
con `DO $$ ... $$` que crea defaults si hace falta, (3) `SET NOT
NULL` + FK + índices. Se usa en
`20260601181401_add_tenant_id_to_existing_tables`.
