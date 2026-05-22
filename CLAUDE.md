# AI Demo Platform — Contexto para Claude Code

> **Instrucción crítica:** Lee este archivo completo antes de responder cualquier cosa.
> Confirma que lo entendiste resumiendo: quién es Jorge, qué estamos construyendo,
> cuál es el Demo 01, y cuáles son las reglas de comunicación que debes seguir.

---

## ¿Qué es este proyecto?

Plataforma de demos incrementales que demuestra casos de uso de IA sobre infraestructura
**Nutanix Enterprise AI (NAI)** on-premise. El objetivo inmediato es una reunión en ~15 días
donde se presentarán los primeros demos a clientes potenciales (universidades y empresas en Ecuador).

Más allá de la demo, este repositorio debe quedar como una **base sólida y bien estructurada**
para seguir creciendo, y como **referencia de buenas prácticas para mentoría**.

**Personas clave:**
- **Edguitar** — socio comercial, vendedor senior de Nutanix. Cierra la venta del hardware y abre la puerta con el cliente. Tiene acceso a hardware NAI para pruebas en el corto plazo.
- **Jorge** — arquitecto de soluciones, full stack developer, responsable técnico del proyecto.
- **Cliente final** — universidades y empresas ecuatorianas que ya compraron o evalúan hardware Nutanix.

---

## Estrategia mock → producción

Durante el desarrollo, los LLMs se consumen via **Anthropic API** (mock local).
En producción, el mismo código apunta a **NAI on-premise** cambiando una variable de entorno.
NAI expone una API 100% compatible con OpenAI. **Cero cambio de lógica de negocio.**

```env
# Desarrollo (mock con Anthropic)
LLM_PROVIDER=anthropic
LLM_BASE_URL=https://api.anthropic.com
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514

# Producción con NAI on-premise
LLM_PROVIDER=nai
LLM_BASE_URL=http://servidor-nutanix-local:8080/v1
LLM_API_KEY=<api-key-generada-en-nai-dashboard>
LLM_MODEL=meta/llama-3.1-70b-instruct
```

> El acceso al hardware NAI de Edguitar está disponible en el corto plazo.
> Cuando llegue ese acceso, Python entra progresivamente (ver hoja de ruta al final).
> Hasta entonces: TypeScript puro.

---

## Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js 14 (App Router) | TypeScript, Tailwind CSS — viene de Claude Design |
| Backend principal | NestJS | TypeScript, REST + SSE streaming |
| Microservicio IA | FastAPI (Python) | Solo cuando NAI esté disponible — ver hoja de ruta |
| ORM (TS) | Prisma | PostgreSQL |
| ORM (Python) | SQLAlchemy | Solo cuando entre FastAPI |
| Vector DB | pgvector (extensión Postgres) | Extensión sobre el mismo Postgres |
| Monorepo | Nx | Apps + packages compartidos |
| LLM client | Anthropic SDK / OpenAI-compatible | Abstracción via LLMAdapter |
| Entorno dev | MacBook Pro M1 Max | Local; Docker para FastAPI cuando corresponda |
| Infraestructura IA futura | Nutanix Enterprise AI + NVIDIA NIM | On-premise, disponible en corto plazo |

### Decisión arquitectónica: stack híbrido TS + Python (progresivo)

**Ahora (Demo 01 y 02):** TypeScript puro. NestJS + Next.js + Prisma + pgvector.

**Cuando llegue NAI:** entra `apps/ai-service` en FastAPI Python para tareas donde Python gana:

```
Cliente (Next.js — viene de Claude Design)
      ↓
NestJS API (orquestador — siempre el punto de entrada)
      ↓                         ↓
LLM Adapter               FastAPI (Python) — futuro
(Anthropic hoy / NAI mañana)   · Extracción avanzada de PDFs (PyMuPDF, pdfplumber)
                                · Embeddings con modelos locales (sentence-transformers)
                                · Procesamiento masivo / batch
                                · Análisis estadístico de corpus (pandas, numpy)
```

**Regla de decisión — ¿TS o Python para cada tarea?**

| Tarea | Dónde vive | Por qué |
|---|---|---|
| Orquestación RAG | NestJS | Lógica de negocio principal |
| Streaming SSE al frontend | NestJS | Nativo, sin overhead |
| Chunking básico (PDFs limpios) | NestJS — rag-core | Suficiente para Demo 01 y 02 |
| Extracción PDFs complejos / escaneados | FastAPI (futuro) | PyMuPDF, pdfplumber, OCR |
| Embeddings via NAI/NIM API | NestJS — LLMAdapter | API REST compatible |
| Embeddings con modelos locales HuggingFace | FastAPI (futuro) | sentence-transformers |
| Procesamiento masivo de documentos | FastAPI (futuro) | pandas, asyncio nativo |
| Tool use / function calling (Demo 04) | NestJS | Lógica de negocio, Prisma/SQL |

---

## Arquitectura C4 — resumen

### Containers principales

```
apps/
├── web/              ← Next.js (TS) — UI de demos; componentes vienen de Claude Design
├── api/              ← NestJS (TS) — orquestador principal, RAG, streaming
└── ai-service/       ← FastAPI (Python) — NO existe aún; entra con NAI

packages/
├── rag-core/         ← (TS) Chunking, vector search, prompt builder
├── llm-adapter/      ← (TS) Abstracción del LLM: Anthropic hoy, NAI mañana
└── db/               ← (TS) Prisma schema + cliente compartido
```

### Componentes clave en `apps/api` (NestJS)

- **IngestModule** — recibe documentos, hace chunking, genera embeddings, almacena en pgvector
- **ChatModule** — recibe pregunta, búsqueda semántica, arma prompt, hace streaming SSE al frontend
- **DemoRegistryModule** — catálogo de demos disponibles con metadata y configuración de cada uno
- **LLMAdapter** — interfaz única al LLM; hoy Anthropic, mañana NAI sin tocar nada más

### Componentes clave en `apps/web` (Next.js — vienen de Claude Design)

> Claude Code NO genera componentes visuales completos.
> Solo genera los contratos (tipos TS, DTOs) y conecta los componentes que llegan de Claude Design.

- **DemoShell** — layout con sidebar de demos y header con branding
- **ChatInterface** — componente de chat con streaming de tokens vía SSE
- **DocumentUploader** — drag & drop de PDFs/Word con progreso de indexación

### Package `rag-core`

- **Chunker** — divide documentos en fragmentos (estrategia: por párrafo o ventana deslizante)
- **EmbeddingService** — genera vectores de texto; abstrae el proveedor del modelo
- **VectorStore** — guarda y busca vectores en pgvector por similitud semántica
- **PromptBuilder** — arma el prompt final: pregunta del usuario + fragmentos encontrados + instrucciones del sistema

---

## Demos planificados (incrementales)

### Demo 01 — Chat con documentos institucionales ✅ PRIORIDAD INMEDIATA
**Tagline:** "Chatea con el reglamento académico de tu universidad"
**Audiencia:** Universidades, RRHH, áreas legales
**Flujo:**
1. Usuario sube PDF (reglamento, manual, contrato)
2. Sistema indexa: chunking → embeddings → pgvector
3. Usuario pregunta en lenguaje natural
4. LLM responde citando el fragmento exacto del documento

**Esfuerzo estimado:** 3–4 días
**Ruta Next.js:** `/demo/rag`
**Endpoints NestJS:**
- `POST /api/v1/ingest` — recibe y procesa el documento
- `GET /api/v1/chat` — responde con streaming SSE

---

### Demo 02 — Comparador de documentos
**Tagline:** "Analiza dos contratos y dime las diferencias de riesgo"
**Audiencia:** Legal, compras, auditoría
**Flujo:**
1. Usuario sube dos o más documentos
2. Elige dimensiones de comparación (cláusulas, riesgos, diferencias)
3. LLM genera análisis estructurado
4. Resultado: tabla comparativa con fuentes citadas

**Esfuerzo estimado:** 4–5 días adicionales
**Ruta Next.js:** `/demo/comparator`

---

### Demo 03 — Analizador de corpus académico
**Tagline:** "Busca tendencias en 500 tesis de los últimos 5 años"
**Audiencia:** Vicerrectorado de investigación, posgrado
**Notas:** Este demo es cuando entra FastAPI Python (procesamiento masivo)
**Ruta Next.js:** `/demo/corpus`

---

### Demo 04 — Agente con acceso a datos estructurados
**Tagline:** "¿Cuántos estudiantes reprobaron Cálculo este semestre?"
**Audiencia:** CIO, rectorado, dirección académica
**Notas:** Tool use / function calling — el LLM genera SQL y el sistema lo ejecuta
**Ruta Next.js:** `/demo/agent`

---

## Convenciones de código

### Nombrado
- **Módulos NestJS:** `PascalCase` + sufijo `Module`, `Service`, `Controller`
- **Componentes Next.js:** `PascalCase`, un componente por archivo
- **Variables de entorno:** `UPPER_SNAKE_CASE`, siempre validadas con `@nestjs/config`
- **Endpoints REST:** `kebab-case`, versionados: `/api/v1/...`

### Patrones arquitectónicos
- **Adapter pattern** en `LLMAdapter` — nunca llamar al SDK del LLM directamente desde módulos de negocio
- **Repository pattern** en `VectorStore` — pgvector no se toca fuera del package `rag-core`
- **Strategy pattern** en `Chunker` — cada estrategia de chunking es una clase separada
- **SSE streaming** para respuestas del LLM — nunca respuesta bloqueante en el chat

### Errores y validación
- DTOs con `class-validator` en todos los endpoints
- Errores del LLM capturados en el `LLMAdapter`, nunca exponer stack traces al frontend
- Logging con `@nestjs/common` Logger, con prefijo por módulo

---

## Base de datos — esquema inicial orientativo

```prisma
model Document {
  id        String   @id @default(cuid())
  name      String
  content   String   // texto completo extraído del PDF
  demoId    String   // identifica a qué demo pertenece este documento
  createdAt DateTime @default(now())
  chunks    Chunk[]
}

model Chunk {
  id         String   @id @default(cuid())
  content    String   // fragmento de texto
  index      Int      // posición del chunk dentro del documento original
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
  // NOTA: el vector de este chunk se guarda en pgvector (tabla nativa),
  // no en Prisma — Prisma no soporta el tipo vector de pgvector directamente
}
```

Los vectores se almacenan en una tabla Postgres nativa con `pgvector`.
Para búsquedas de similitud se usa `$queryRaw` de Prisma.

---

## Reglas antes de cada tarea — Claude Code debe respetar siempre

1. **Usar siempre el `LLMAdapter`** — nunca instanciar Anthropic o cualquier SDK de LLM directamente en módulos de negocio
2. **Demo 01 es la prioridad absoluta** — no empezar Demo 02 hasta que Demo 01 esté completamente funcional
3. **Streaming primero** — la experiencia de ver tokens aparecer en tiempo real es parte del impacto del demo; nunca hacer respuestas bloqueantes en el chat
4. **Variables de entorno validadas desde el inicio** — usar `@nestjs/config` con schema de validación
5. **Base sólida, sin over-engineering** — el proyecto tiene doble propósito: los demos para la reunión de ~15 días **y** quedar como base bien estructurada para crecer y referencia de buenas prácticas para mentoría. Por eso se invierte en estructura limpia, convenciones claras, documentación y patrones bien explicados — eso es el objetivo, no over-engineering. Lo que sí se evita es la **complejidad especulativa**: abstracciones, features o configuración que nadie necesita todavía. Regla práctica: cada pieza debe estar justificada hoy y quedar bien explicada
6. **Compatibilidad NAI garantizada** — toda llamada al LLM pasa por `LLMAdapter`; el switch a NAI debe ser solo cambiar variables de entorno

---

## Comandos útiles del monorepo

```bash
# Levantar servicios en desarrollo
nx serve api          # NestJS backend en :3000
nx serve web          # Next.js frontend en :4200

# Generar nuevo módulo NestJS
nx g @nx/nest:module <nombre> --project=api

# Generar nueva página Next.js
nx g @nx/next:page <ruta> --project=web

# Migraciones Prisma
npx prisma migrate dev --name <descripcion>

# Activar pgvector en Postgres (una sola vez)
psql -d <nombre-db> -c "CREATE EXTENSION IF NOT EXISTS vector;"

# --- Comandos Python (solo cuando entre FastAPI) ---
# Levantar ai-service directo
cd apps/ai-service && uvicorn main:app --reload --port 8000

# Levantar ai-service con Docker
docker compose up ai-service

# Instalar dependencias Python
cd apps/ai-service && pip install -r requirements.txt
```

---

## Contexto del desarrollador — MUY IMPORTANTE

### Perfil técnico de Jorge

- **Stack en transición activa:** Jorge está en proceso de consolidar su conocimiento en Node.js, TypeScript y React. Viene de otros lenguajes. **No asumir dominio avanzado** — explicar siempre el contexto de cada decisión técnica.
- **Python:** Lo usa ocasionalmente en la Maestría en IA Aplicada. No es su lenguaje diario. Cuando aparezca código Python en el proyecto, explicarlo con el mismo nivel de detalle que el TypeScript.
- **Conceptos de IA:** La maestría está en curso. Términos como embeddings, chunking, inferencia, fine-tuning, similitud coseno, tokens — **nunca asumir que son conocidos**. Siempre acompañar con una analogía o explicación breve la primera vez que aparecen.
- **Principio de trabajo:** _"prefiero entender bien 1 cosa antes de pasar a la siguiente"_ — no avanzar al siguiente componente si el anterior no quedó claro. Preguntar si hay dudas antes de continuar.

---

### Estilo de comunicación — OBLIGATORIO en todo momento

Claude Code debe seguir estas reglas durante **todo** el proceso de desarrollo:

1. **Analogías siempre** — antes de mostrar código de un concepto nuevo, explicarlo con una analogía del mundo real. Si se introduce un patrón (Repository, Adapter, Strategy), la analogía va primero.

2. **Una cosa a la vez** — no generar múltiples archivos de golpe sin explicación. Crear una pieza, explicarla, confirmar que quedó clara, luego avanzar.

3. **Comentarios en el código** — todo código generado lleva comentarios que explican el *por qué*, no solo el *qué*. Especialmente en lógica de RAG, embeddings y llamadas al LLM.

4. **Nunca usar jerga técnica de IA sin contexto** — siempre agregar una línea explicativa entre paréntesis o como comentario en el código.

5. **Confirmar comprensión** — después de explicar un concepto nuevo o crear un componente importante, preguntar: "¿Quedó claro esto antes de continuar?"

**Ejemplo de cómo NO comunicar:**
> "Implementamos el VectorStore usando similitud coseno sobre pgvector."

**Ejemplo de cómo SÍ comunicar:**
> "Implementamos el VectorStore — piénsalo como el buscador interno del sistema.
> En lugar de buscar por palabras exactas (como Ctrl+F), busca por *significado*.
> La similitud coseno es la fórmula que mide qué tan parecido es el significado de dos textos —
> da un número entre 0 (nada parecido) y 1 (idéntico en significado).
> pgvector es la extensión de Postgres que hace esa búsqueda de forma eficiente."

---

### Frontend — flujo de trabajo con Claude Design

**El frontend se construye en la herramienta Claude Design**, no directamente en Claude Code.
Jorge diseña la UI en Claude Design y luego trae los componentes para conectarlos al backend.

**Lo que Claude Code SÍ hace en el frontend:**
- Definir contratos de API: tipos TypeScript, DTOs, estructura exacta de las respuestas
- Definir cómo se consume el streaming SSE desde Next.js
- Conectar los componentes que llegan de Claude Design al backend (endpoints, tipos, hooks)
- Revisar que los componentes de Claude Design sean compatibles con el contrato definido

**Lo que Claude Code NO hace:**
- Generar componentes visuales de UI completos desde cero
- Tomar decisiones de diseño o layout

**Flujo de trabajo entre herramientas:**
```
Claude Code (backend + contrato)     Jorge en Claude Design (UI)
────────────────────────────────     ────────────────────────────
1. Define endpoint y tipos TS    →   2. Diseña UI con esos contratos
3. Recibe componente terminado   ←
4. Conecta al backend y revisa   →   5. Prueba integración completa
```

**Regla:** el contrato (tipos, endpoints, estructura de respuesta) siempre se define en Claude Code **antes** de que Jorge empiece a construir la UI en Claude Design.

---

## Hoja de ruta Python en el proyecto

| Fase | Trigger | Qué entra en Python |
|---|---|---|
| **Ahora** | Demo 01 y 02 | Nada — TypeScript puro |
| **Corto plazo** | Acceso a hardware NAI disponible | `ai-service` FastAPI; embeddings via NIM API |
| **Demo 03** | Corpus académico | pandas, procesamiento batch, PDFs complejos |
| **Escala** | Cliente real firmado | sentence-transformers, modelos locales HuggingFace |
