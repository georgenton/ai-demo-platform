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

Una lista de números, generalmente de tamaño fijo (ej. 1024 o 1536). En este
proyecto, cada chunk se convierte en un vector vía un **modelo de embeddings**
y se guarda en Postgres con pgvector.

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
