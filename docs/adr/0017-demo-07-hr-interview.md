# ADR-0017 — Demo 07: Avatar entrevistador HR (screening de candidatos)

- **Estado:** Aceptado
- **Fecha:** 2026-06-05
- **Decisores:** Jorge
- **Relacionado:**
  - [`ADR-0013`](./0013-multi-tenant-saas-architecture.md) — Industries y tenants
  - [`ADR-0012`](./0012-demo-05-english-tutor.md) — Voz nativa del browser
  - [`ADR-0016`](./0016-demo-06-clinical-assistant.md) — Consolidación de hooks de voz a shared
  - Demo 04 (Agent): se reusa el patrón de scoring con tool calling

## Contexto

El catálogo cubre **cinco verticales** (universidad, banca, legal, salud,
gobierno, retail) pero todos los demos actuales son "consultas a documentos
o datos". Falta un demo que muestre **IA conversacional con voz** sobre un
caso de negocio donde NAI on-prem gana fuerte.

Screening HR (entrevista de primer filtro) cumple las 4 dimensiones del
framework de priorización del backlog:

- **Privacidad**: la entrevista contiene datos personales del candidato
  (cédula, salario previo, ubicación, historia laboral) bajo la **Ley
  Orgánica de Protección de Datos Personales (Ecuador 2021)**. Enviar
  audio + transcripción a Anthropic/OpenAI cloud es legalmente complicado
  para empresas grandes con compliance interno.
- **Costo**: una empresa mediana hace 500–2000 entrevistas/mes (admisiones
  universitarias, retail, banca, call centers). A ~$0.05 USD por entrevista
  en cloud = ~$50–100 USD/mes. A escala enterprise (10K/mes) = $500/mes que
  NAI cobra $0 variable.
- **Latencia**: una entrevista por voz es la única demo donde la latencia
  del LLM se "siente". Round-trip a US-East = ~600ms vs NAI local = ~50ms.
  La diferencia entre conversación natural vs robótica.
- **Disponibilidad**: un outage de Anthropic durante una entrevista en vivo
  rompe la experiencia. NAI on-prem corre sobre la infra del cliente.

El Demo 06 (Asistente clínico) ya consolidó los hooks de voz nativa en
`components/shared/voice/`. Demo 07 los reusa sin friction adicional.

## Decisión

Construimos el **Demo 07 — Avatar entrevistador HR** como el séptimo demo
del catálogo. Funcionalmente:

1. El reclutador (usuario del sistema) crea una entrevista eligiendo el
   **rol** (de un catálogo seedeado) y registrando el **nombre del candidato**.
2. El candidato responde por **voz**, una pregunta a la vez. El avatar le
   habla (TTS) la pregunta, el candidato la responde por mic (STT), el
   sistema confirma y avanza.
3. Al cerrar la entrevista, el LLM **evalúa la transcripción completa** y
   devuelve scoring por dimensión + recomendación final.
4. El reclutador ve la **pantalla de cierre** con el scoring; queda
   persistido para revisión posterior.

### Decisiones de alcance (todas confirmadas con Jorge)

| Decisión                       | Elegido | Implicación                                                                                                                                                                   |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modalidad input**            | **1A**  | Voz pura — el candidato responde solo por mic. Sin teclado. Requiere Chrome (SpeechRecognition). En vivo no es problema; producción real necesitaría reevaluar.               |
| **Origen del rol y preguntas** | **2A**  | Pre-cargados en seed. 6 roles iniciales con 5–7 preguntas cada uno. Sin upload de JD por PDF, sin form de creación en esta vuelta.                                            |
| **Salida final**               | **3A**  | Scoring por dimensión + recomendación en pantalla. **Sin PDF, sin email.** El reclutador ve el resultado, queda en la base.                                                   |
| **Persistencia**               | **4C**  | Persistimos **todo** menos el audio: rol, candidato, transcripción literal pregunta-por-pregunta, scoring, recomendación. Audio queda fuera (Ley de Datos Personales Art. 7). |

### Schema Prisma — 4 modelos nuevos

```prisma
model Job {
  id              String        @id @default(cuid())
  tenantId        String
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  slug            String        // e.g. 'dev-junior-backend'
  title           String        // e.g. 'Desarrollador junior backend'
  description     String        // 1-2 párrafos
  dimensions      String[]      // ej: ['claridad', 'conocimiento técnico', 'experiencia', 'cultural fit']
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  questions       JobQuestion[]
  interviews      Interview[]

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model JobQuestion {
  id              String        @id @default(cuid())
  jobId           String
  job             Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)
  order           Int           // 0-indexed dentro del job
  text            String        // pregunta literal que el avatar dice
  rubric          String        // qué debería contener una buena respuesta
  answers         InterviewAnswer[]

  @@unique([jobId, order])
  @@index([jobId])
}

model Interview {
  id              String        @id @default(cuid())
  tenantId        String
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  jobId           String
  job             Job           @relation(fields: [jobId], references: [id])
  candidateName   String        // nombre del candidato (libre)
  candidateExternalId String?   // cédula opcional
  status          InterviewStatus @default(in_progress)
  startedAt       DateTime      @default(now())
  finishedAt      DateTime?
  // Resultado final (poblado cuando el LLM finaliza el scoring).
  scoring         Json?         // { dimensions: [{name, score, evidence}, ...], overall: 0..100, recommendation: 'hire' | 'reject' | 'reconsider' }
  answers         InterviewAnswer[]

  @@index([tenantId])
  @@index([tenantId, jobId])
  @@index([tenantId, startedAt(sort: Desc)])
}

enum InterviewStatus {
  in_progress
  finalized
  abandoned
}

model InterviewAnswer {
  id              String        @id @default(cuid())
  interviewId     String
  interview       Interview     @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  questionId      String
  question        JobQuestion   @relation(fields: [questionId], references: [id])
  transcript      String        // transcripción literal (palabra por palabra)
  durationSeconds Int?          // opcional, lo manda el cliente
  answeredAt      DateTime      @default(now())

  @@unique([interviewId, questionId])
  @@index([interviewId])
}
```

Razones de las decisiones de schema:

- **`Job.dimensions` como `String[]`**: cada rol decide sus propias dimensiones
  a evaluar (un rol técnico mide "conocimiento técnico"; un rol comercial mide
  "manejo de objeciones"). No las modelamos como tabla aparte porque solo se
  consumen en el prompt del scoring; meter overhead relacional no aporta.
- **`Interview.scoring` como `Json`**: el shape lo define el LLM con un schema
  JSON fijo. Json permite evolucionar el shape sin migraciones. Trade-off:
  perdemos type-safety SQL, pero se gana flexibilidad para evolucionar el
  análisis.
- **`InterviewAnswer.durationSeconds` opcional**: útil para detectar respuestas
  sospechosamente cortas o largas; no crítico. Lo manda el cliente.
- **Unique compuesto `(interviewId, questionId)`**: una pregunta por entrevista,
  sin duplicados aunque el candidato re-grabe.

### Endpoints planificados

| Método | Path                                       | Función                                                                                                                |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/hr/jobs`                          | Lista de roles disponibles para el tenant.                                                                             |
| GET    | `/api/v1/hr/jobs/:id`                      | Detalle del rol + total de preguntas (sin exponer la rúbrica).                                                         |
| POST   | `/api/v1/hr/interviews`                    | Crea una entrevista: body `{ jobId, candidateName, candidateExternalId? }`. Devuelve `{ interviewId, firstQuestion }`. |
| GET    | `/api/v1/hr/interviews/:id/next-question`  | Devuelve la siguiente pregunta del rol, o `{ done: true }` si terminaron todas.                                        |
| POST   | `/api/v1/hr/interviews/:id/answer`         | Guarda la transcripción de la respuesta a la pregunta actual. Body: `{ questionId, transcript, durationSeconds? }`.    |
| POST   | `/api/v1/hr/interviews/:id/finalize` (SSE) | El LLM evalúa todas las respuestas con tool calling y emite el scoring final. Persiste `scoring` + `finishedAt`.       |

### Flow de una entrevista

```
1. Reclutador entra al demo, selecciona rol "Dev junior backend".
2. Form: nombre del candidato + cédula opcional.
3. POST /interviews → devuelve interviewId + primera pregunta.
4. Avatar habla la pregunta (TTS, lang del reclutador o configurable).
5. Candidato presiona el mic (gigante, centro de pantalla) y responde.
6. Cuando para de hablar, el sistema:
   - Muestra el transcript final con opción "Confirmar" o "Volver a grabar".
   - Confirma → POST /answer.
7. GET /next-question → siguiente o `done: true`.
8. Al `done: true`, el reclutador ve "Generar evaluación" → POST /finalize (SSE).
9. Pantalla de cierre: scoring por dimensión (cards con score 0-100 + 1
   evidencia citando la respuesta) + recomendación final ('hire' / 'reject'
   / 'reconsider') + un párrafo de "fortalezas" + un párrafo de "oportunidades".
```

### Roles seedeados (6 iniciales)

| Slug                       | Título                         | Dimensiones                                                                |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `dev-junior-backend`       | Desarrollador junior backend   | claridad, conocimiento técnico, capacidad de aprendizaje, motivación       |
| `dev-senior-fullstack`     | Desarrollador senior fullstack | conocimiento técnico, experiencia, liderazgo técnico, comunicación         |
| `comercial-ventas-b2b`     | Ejecutivo comercial B2B        | comunicación, manejo de objeciones, orientación a resultados, cultural fit |
| `customer-success`         | Customer success               | empatía, resolución de problemas, comunicación, orientación al cliente     |
| `asistente-administrativa` | Asistente administrativa       | organización, comunicación, manejo de presión, atención al detalle         |
| `gerente-operaciones`      | Gerente de operaciones         | liderazgo, toma de decisiones, gestión de equipos, visión estratégica      |

Cada uno con 5–7 preguntas adaptadas al perfil. El primer rol (dev junior)
tendrá preguntas como "Cuéntame sobre un proyecto donde tuviste que aprender
una tecnología nueva" + "Explica qué es REST en tus palabras" + etc.

## Alternativas consideradas

- **Avatar 3D / video sintético** (D-ID, HeyGen). Descartado: agrega ~$5K/mes
  en costos y bloquea on-prem (esos servicios solo viven en cloud). No agrega
  valor de venta real — el candidato no necesita ver una cara virtual hablando,
  necesita ser entrevistado consistentemente.
- **2B (upload de JD por PDF, sistema extrae preguntas)**. Descartado por
  alcance: agrega 1 día y otra UI sin amortización clara para el demo. Buena
  feature para una segunda iteración.
- **3B (PDF descargable)**. Descartado por alcance: pdfkit + maquetación
  ocuparía 1 día y la mayoría de los reclutadores hacen screenshot del scoring
  o copy-paste. Buena feature para una segunda iteración.
- **4B (persistir solo metadata, sin transcripción literal)**. Descartado:
  el reclutador frecuentemente quiere releer la respuesta literal a una
  pregunta clave después de un par de horas. La transcripción cabe en texto;
  no hay razón de privacidad para no guardarla si el audio queda fuera.

## Consecuencias

### Positivas

- Primer demo del catálogo con **IA conversacional con voz** completa
  (Demo 06 tiene voz como secundaria; Demo 05 la tiene como pieza
  principal pero en un caso de uso muy chico).
- Reusa el componente de voz consolidado en `components/shared/voice/` —
  cero infra nueva.
- Vendible cross-industry (admisiones universitarias, banca, retail,
  gobierno, call centers). El catálogo se vuelve más diverso.
- Persistencia completa permite vender "auditoría de procesos de selección"
  como feature secundaria.

### Negativas / riesgos

- **Browser dependence**: solo Chrome funciona bien con SpeechRecognition.
  Si un cliente quiere ofrecer entrevistas remotas a candidatos con Safari/
  Firefox, hay que abordar. **Mitigación**: documentar limitación en el
  banner del demo + recomendar Chrome.
- **Calidad del STT en español**: el reconocedor del browser tiene buena
  precisión en ES neutro pero falla con acentos regionales fuertes. Para el
  demo en vivo es OK; para producción enterprise habría que evaluar STT
  comercial. **Mitigación**: el reclutador puede leer el transcript antes
  de confirmar y rehacer la respuesta si está corrupta.
- **Sesgo en scoring**: el LLM puede tener sesgos de género/edad/origen.
  Banner advirtiendo "el scoring del LLM debe revisarse por un humano antes
  de decidir contratación", igual que el banner clínico. La auditoría queda
  en la transcripción persistida.
- **Carga del Postgres**: una entrevista grabada genera ~5–7 filas de
  `InterviewAnswer`. Para 2000 entrevistas/mes = ~12K filas/mes. No es nada
  significativo para Postgres pero conviene un index por `tenantId, startedAt`
  para listados eficientes.

### Lo que NO está en esta vuelta (alcance excluido)

- Upload de JD por PDF (decisión 2A).
- Generación de PDF + email (decisión 3A).
- Audio guardado (decisión 4C).
- Entrevistas multi-turn dentro de una pregunta (cada pregunta es una
  respuesta única, sin clarificaciones).
- Detección de marcadores de mentira / análisis de sentimiento (potencial
  segunda iteración).
- Re-entrevistar al mismo candidato para otro rol (cada Interview es
  independiente; lo unimos por `candidateExternalId` si está cargado, pero
  no hay UI de "histórico del candidato").

## Plan de implementación

5 PRs siguiendo el patrón del Demo 06:

1. **PR 1 — Schema + seed (este ADR + migración + datos)**: lo que viene
   en esta PR. Genera la tabla y los 6 roles con sus preguntas.
2. **PR 2 — `HrModule` backend**: endpoints REST + SSE de finalize con tool
   calling para scoring.
3. **PR 3 — Contrato frontend + handoff a Claude Design**: tipos espejo,
   cliente HTTP, hook `useInterviewSession`, handoff doc.
4. **PR 4 — Integración UI** (Claude Design devuelve el paquete): página
   `/demo/interview`, componentes (selector de rol, pantalla de entrevista
   en vivo con avatar + mic gigante, pantalla de cierre con scoring),
   activación catálogo + i18n + ADR a `Aceptado`.
5. **(opcional) PR 5 — Polish**: i18n final, script de demo, runbook
   updates.

Esfuerzo total estimado: **~1 semana** (5 días hábiles).
