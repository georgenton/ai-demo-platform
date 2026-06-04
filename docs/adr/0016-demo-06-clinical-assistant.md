# ADR-0016 — Demo 06: Asistente clínico para historia clínica + protocolos

- **Estado:** Aceptado
- **Fecha:** 2026-06-04
- **Decisores:** Jorge
- **Relacionado:**
  - [`ADR-0013`](./0013-multi-tenant-saas-architecture.md) — Industries y tenants
  - [`ADR-0008`](./0008-openai-embeddings-for-dev.md) — Embeddings provider
  - Demo 01 (RAG): se reusa la maquinaria de chunking + pgvector
  - Demo 04 (Agent): se reusa el patrón de tool calling

## Contexto

Salud es el vertical de Ecuador donde NAI on-prem brilla más fuerte: la
**Ley Orgánica de Salud Art. 7** y el **Reglamento de Información
Confidencial en Salud (Acuerdo 5216, 2015)** prohíben que datos de
historia clínica salgan de la red privada del prestador de salud.
Cualquier solución que use Anthropic/OpenAI cloud queda fuera de
norma — esto es vendible **solo** con infraestructura on-prem.

Hoy el catálogo no tiene un demo para la industria `salud` (ver
`docs/demos-backlog.md`). Los clientes potenciales (Metropolitano,
Cruz Roja, IESS, clínicas privadas grandes) no tienen un caso de uso
en el catálogo actual.

## Decisión

Construimos el **Demo 06 — Asistente clínico** como el sexto demo del
catálogo. Funcionalmente, el médico le pasa al asistente un motivo
de consulta + datos del paciente, y el asistente devuelve:

1. **Resumen de historia clínica relevante** (RAG sobre consultas previas
   del paciente, filtradas por relevancia al motivo de consulta).
2. **Diagnósticos diferenciales sugeridos** con criterios de exclusión
   (preguntas a hacer para descartar cada uno).
3. **Alertas de interacciones medicamentosas** entre la medicación actual
   y posibles terapias del diagnóstico sugerido.
4. **Citas a protocolos clínicos** del hospital (RAG sobre el corpus
   institucional).

**Importante — qué NO es:**

- **No es un diagnosticador autónomo.** Es un asistente que aporta
  contexto al médico humano. El demo debe enfatizar esta posición:
  "el sistema sugiere, el médico decide". Esto es estándar de la
  industria (Epic, IBM Watson Health) y reduce riesgo regulatorio.
- **No reemplaza al expediente clínico electrónico.** Solo lee de él
  vía API o se le sube manualmente un fragmento. No persistimos
  modificaciones al historial.
- **No emite recetas ni órdenes médicas.** Solo sugiere texto que el
  médico copia/pega o transcribe a su sistema oficial.

## Alcance funcional del MVP

### Inputs del médico (form chat-like)

- **Paciente** (obligatorio): nombre, edad, género, alergias, condiciones
  crónicas, medicación actual.
- **Motivo de consulta** (obligatorio): texto libre o categorías
  predefinidas.
- **Hallazgos del examen físico** (opcional): texto libre.
- **Estudios complementarios** (opcional): texto libre con resultados.

### Outputs del asistente (panel de 3 columnas)

| Columna                    | Contenido                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Historia relevante**     | Cita textual de las 3-5 consultas previas relacionadas con el motivo. Cada cita tiene fecha, médico tratante, y un resumen de 1 frase.                                     |
| **Diagnósticos sugeridos** | 3-5 hipótesis ordenadas por probabilidad. Cada una: nombre, criterios a favor (en este paciente), criterios contra, preguntas/estudios para confirmar/descartar.           |
| **Alertas y protocolos**   | Interacciones medicamentosas detectadas (severidad: leve/moderada/severa). Protocolos clínicos del hospital aplicables al diagnóstico más probable, con cita al documento. |

### Flujo de datos

```
Médico (UI) → Backend NestJS (Demo 06 module)
                ├─ Embebe motivo + historia → pgvector search consultas previas
                │   (filtrado por paciente.id + tenantId)
                ├─ Embebe motivo → pgvector search protocolos hospital
                │   (filtrado por tenantId + demoId='clinical')
                ├─ Construye prompt estructurado
                ├─ LLM Adapter (Anthropic en dev / NAI en prod)
                │   → tool calling: getMedicationInteractions(currentMeds, suggestedMeds)
                └─ Streaming SSE → UI (paneles se rellenan en vivo)
```

## Schema de datos nuevos

```prisma
model Patient {
  id              String   @id @default(cuid())
  tenantId        String   // multi-tenant (ADR-0013)
  externalId      String?  // ID del paciente en el HIS del hospital
  // PII pseudonimizada para el demo (datos sintéticos en seed)
  displayName     String
  age             Int
  gender          String   // 'M' | 'F' | 'O'
  allergies       String[] // ej. ['penicilina', 'mariscos']
  chronicConditions String[] // ej. ['HTA', 'DM2']
  currentMedications String[] // ej. ['metformina 850mg', 'enalapril 10mg']

  consultations   Consultation[]
  tenant          Tenant @relation(...)

  @@unique([tenantId, externalId])
  @@index([tenantId])
}

model Consultation {
  id              String   @id @default(cuid())
  tenantId        String
  patientId       String
  date            DateTime
  treatingPhysician String
  reasonForVisit  String
  examFindings    String?
  diagnosis       String
  treatment       String
  notes           String?

  // pgvector para search semántico — la maquinaria de Demo 01 ya la conoce
  // (el embedding va en una columna no-Prisma + index HNSW).

  patient         Patient @relation(...)
  tenant          Tenant @relation(...)

  @@index([tenantId, patientId])
  @@index([tenantId, date])
}

model ClinicalProtocol {
  id              String   @id @default(cuid())
  tenantId        String
  title           String
  category        String   // ej. 'cardiología', 'urgencias'
  content         String   // markdown
  // Mismo patrón de Document/Chunk del Demo 01 para RAG sobre protocolos.

  tenant          Tenant @relation(...)
}
```

## Arquitectura técnica

### Backend (NestJS)

- **`apps/api/src/app/clinical/`** — módulo nuevo.
- **Endpoints:**
  - `GET /api/v1/clinical/patients?q=...` — lookup de paciente (filtrado por tenantId).
  - `GET /api/v1/clinical/patients/:id` — detalle de paciente con historia.
  - `POST /api/v1/clinical/consultation/analyze` — SSE streaming del análisis.
- **Tool calling**: `getMedicationInteractions(meds: string[])`. En el MVP es un
  mock con interacciones ficticias (database hardcoded). En v2 se conecta a una
  API real (Drugbank, OpenFDA).

### Frontend (Next.js)

- **`apps/web/src/app/(shell)/demo/clinical/page.tsx`** — UI nueva.
- **Layout**:
  - Sidebar izquierdo: search de pacientes (autocomplete).
  - Panel central: form de consulta (motivo, hallazgos).
  - Tres paneles a la derecha: historia relevante, dx sugeridos, alertas.

### LLM

- **Prompt estructurado** que pide al LLM 3 secciones JSON (historia, dx,
  alertas) con shape fijo. Validado con un schema Zod en el backend.
- **Anthropic Claude Sonnet** en dev. **NAI on-prem (Llama 3.1 70B o similar)**
  en producción. El LLMAdapter del proyecto ya abstrae esto.

### Seed sintético (CRÍTICO)

**No usamos datos reales de pacientes.** Generamos 30-50 pacientes ficticios
con LLM (prompt determinístico con seed) + 100-200 consultas con vocabulario
médico realista + 20-30 protocolos clínicos sintéticos.

Script: `packages/db/prisma/seed-clinical.ts`. Patrón de los otros seeds del
proyecto. Idempotente.

## Plan de implementación

### PR 1 — Schema + seed (~1 día)

- Migración Prisma con `Patient`, `Consultation`, `ClinicalProtocol`.
- Seed sintético determinístico.
- Sin lógica de negocio todavía.
- Tests del seed (que verifica idempotencia + count esperado).

### PR 2 — Backend del análisis (~2-3 días)

- `ClinicalModule` con los 3 endpoints.
- Schema Zod del output JSON del LLM.
- Tool calling para interacciones medicamentosas (mock).
- Tests unitarios del prompt builder.

### PR 3 — Frontend UI (~2-3 días)

- Página `/demo/clinical` con search de pacientes + 3 paneles.
- Streaming SSE consumido con `useChatStream` (ya existe).
- Componentes UI nuevos: `PatientCard`, `DxPanel`, `InteractionsPanel`,
  `ProtocolCitation`.

### PR 4 — Catálogo, industries y i18n (~1 día)

- Demo registry: agregar `clinical` con metadata.
- Industries: `salud` se habilita con `clinical` por default.
- Strings i18n (ES + EN).
- ADR-0016 pasa de "Propuesto" a "Aceptado".

### PR 5 — Documentación + script demo (~medio día)

- Guion de demo en `docs/demo-script.md`.
- ADR final.
- Update CHANGELOG.

**Esfuerzo total estimado:** 1-1.5 semanas calendario.

## Riesgos y mitigaciones

| Riesgo                                                                      | Mitigación                                                                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| El LLM inventa diagnósticos o medicamentos falsos                           | Schema Zod rechaza output mal formado. Tests con prompts conocidos. UI siempre muestra "Sugerencia, no diagnóstico".                         |
| Cliente real intenta cargar historia clínica de paciente real en producción | Banner permanente en la UI: "Datos sintéticos para demo. Cargar pacientes reales requiere certificación HIPAA/Ley Salud." Disclaimer en T&C. |
| Mostrar dosis incorrectas en una demo en vivo                               | Seed con dosis dentro de rangos estándar verificados. Disclaimer claro de "valores ilustrativos".                                            |
| El demo se confunde con un MVP comercial real                               | El alcance documenta explícitamente "asistente, no diagnosticador". Se acompaña en demo con disclaimer del speaker.                          |

## Decisiones que faltan confirmar con Jorge

Antes de arrancar el código necesito tres decisiones:

1. **Pacientes únicos o catálogo compartido?**
   - **A.** Cada tenant tiene sus propios pacientes ficticios (multi-tenant
     puro, los pacientes se aíslan).
   - **B.** Hay un set de 30-50 pacientes ficticios compartidos por todos los
     tenants de industria `salud` (menos código, fácil de demostrar).
   - **Mi recomendación:** **B** para el MVP. Es coherente con el resto del
     catálogo (los protocolos clínicos se seedean por tenant pero los pacientes
     pueden ser compartidos en demos).

2. **¿Voz como input?**
   - **A.** Solo texto (más simple, MVP fácil).
   - **B.** Voz nativa del browser (como Demo 05), porque "el médico está con
     manos ocupadas con el paciente".
   - **Mi recomendación:** **A** para el MVP. La voz suma 2-3 días y no es
     decisiva para vender. Si el cliente la pide, la sumamos en v2.

3. **¿Cómo se carga historia clínica en el demo?**
   - **A.** Pre-cargada con el seed (médico solo busca paciente).
   - **B.** El médico la sube en cada sesión (PDF o texto).
   - **C.** Las dos (preferred path: A; fallback B para casos no seedeados).
   - **Mi recomendación:** **A** en MVP. Más fluido para presentar al cliente.

## Consecuencias

- **+1 demo en el catálogo** con score 5/5 — el primero específico de salud.
- **Reutiliza** Demo 01 (RAG), Demo 04 (tool calling), patrón multi-tenant
  (PR #71).
- **Schema nuevo en Prisma** (3 modelos). Migración idempotente.
- **Apertura del vertical salud** — Metropolitano, Cruz Roja, IESS, clínicas
  grandes pasan a ser leads activos.

## Referencias

- Ley Orgánica de Salud, Art. 7 (Ecuador 2006, reformada 2012).
- Reglamento de Información Confidencial en Salud (Acuerdo 5216, 2015).
- Epic Systems "AI Assistant for Charting" (referencia de competidor).
- IBM Watson Health "Clinical Decision Support" (referencia de competidor).
