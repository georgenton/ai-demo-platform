# Handoff de diseño — Demo 06 "Asistente clínico"

> **Cómo usar este documento.** Pásaselo (o pídele que lo lea desde el
> repo) al inicio de una conversación continuada con Claude Design,
> que ya conoce este proyecto desde el diseño inicial del frontend y
> el sprint multi-tenant.
>
> No repetimos contexto de tokens, sistema de design ni layouts del
> ui-kit — solo lo nuevo del Demo 06.

---

## Hola, Claude Design — volvemos

Vamos por el **Demo 06: Asistente clínico**. Sexto demo de la
plataforma, primer demo orientado a la industria `salud`. Tu trabajo
es la UI completa de `/demo/clinical`. El backend ya está listo y
deployado en producción (ver "Estado del backend" abajo).

Toda la decisión de alcance está en el **ADR-0016** (lee
`docs/adr/0016-demo-06-clinical-assistant.md` para el contexto largo
si quieres). Resumen ejecutivo de las tres decisiones que ya cerramos:

| Decisión              | Elegido | Significado para la UI                                                                                                                       |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quién es paciente** | **1B**  | 30 pacientes ficticios compartidos por todos los tenants de industria `salud`. La UI no tiene "crear paciente nuevo" en esta primera vuelta. |
| **Modalidad input**   | **2B**  | Texto + voz nativa del browser (reusa Demo 05). La voz entra en un PR siguiente — por ahora deja un placeholder visible.                     |
| **Origen de datos**   | **3C**  | Pacientes pre-cargados desde el seed. Opción de "subir un caso ad-hoc" queda **fuera del MVP** — no diseñes para eso.                        |

---

## El pitch del demo en una frase

> "Un médico abre el expediente de un paciente, pregunta en lenguaje
> natural — '¿puedo recetarle amoxicilina?' — y el asistente responde
> citando la historia clínica del paciente y advirtiendo sobre
> interacciones con su medicación actual."

**Audiencia objetivo**: directores médicos, jefes de servicio,
auditores médicos, CIOs de hospital. La emoción que tiene que
provocar el demo es "esto le ahorra al residente 10 minutos por
paciente y le da una segunda mirada al jefe de servicio".

---

## Estado del backend (lo que ya está hecho)

| Pieza                                                                | Estado                                            |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| Schema Prisma + migración aplicada en producción                     | Listo (PR #79)                                    |
| Seed corrido en Railway (30 pacientes, 193 consultas, 25 protocolos) | Listo                                             |
| Endpoints `/api/v1/clinical/*` montados                              | Listos (PR #80) — gateados por demo no habilitado |
| Tool calling `check_drug_interactions`                               | Listo                                             |
| Tipos TypeScript del frontend                                        | Listos (este PR)                                  |
| Cliente HTTP + SSE                                                   | Listos (este PR)                                  |
| Hook `useClinicalAnalyze`                                            | Listo (este PR)                                   |

**El demo aún no aparece en el sidebar** porque el catálogo
(`demo-registry.service.ts`) y el `enabledDemos: ['rag', 'agent']` de
la industria `salud` todavía no incluyen `'clinical'`. Eso lo activas
**tú en tu PR final de integración** — ver "Lo que tu PR debe
incluir" al final.

---

## Lo nuevo desde la última conversación

| Área                 | Nuevo en Demo 06                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Industria objetivo   | Primera vez que armamos un demo para `salud`. Es un demo nicho — no esperés reusar componentes de los demos universitarios sin pensar.                                                                |
| Banner permanente    | Por la sensibilidad clínica, **arriba de toda la pantalla** del demo va un banner permanente "Datos sintéticos — no usar con pacientes reales".                                                       |
| Mensajes defensivos  | Cada respuesta del LLM termina con "La decisión clínica final corresponde al médico tratante". El prompt del backend ya lo fuerza — no lo dupliques en UI.                                            |
| Tool calling visible | El SSE emite eventos tipados `tool_call` y `tool_result`. La UI los renderiza como cards inline en la timeline del LLM — parecido al Demo 04 pero más visual ("Consultando interacciones de X y Y…"). |

---

## El trabajo, en un solo bloque

Una página, tres paneles, un banner. Va en un solo PR cerrando todo el demo
de punta a punta.

### Layout sugerido

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛈 Datos sintéticos · No usar con pacientes reales · Base ficticia      │  ← Banner permanente
├──────────────┬──────────────────────────────────┬───────────────────────┤
│  PACIENTES   │   HISTORIA CLÍNICA               │   ASISTENTE           │
│              │                                  │                       │
│  [search]    │   María Elena Vásquez            │   ¿Cómo te ayudo?     │
│              │   67 años · F                    │                       │
│  ┌────────┐  │                                  │   ┌─────────────────┐ │
│  │ María  │  │   Alergias: penicilina           │   │ Sugerencias:    │ │
│  │ 67 F   │  │   Condiciones: HTA, DM2          │   │ • ¿Puedo darle  │ │
│  │ HTA DM2│  │   Medicación actual:             │   │   amoxicilina?  │ │
│  └────────┘  │   • metformina 850mg BID         │   │ • Resume su     │ │
│  ┌────────┐  │   • enalapril 10mg QD            │   │   historia      │ │
│  │ Carlos │  │   • AAS 100mg QD                 │   └─────────────────┘ │
│  │ 58 M   │  │                                  │                       │
│  │ HTA    │  │   Últimas consultas              │   ┌─────────────────┐ │
│  └────────┘  │   ▸ 2025-09-12  Control HTA      │   │ [texto del LLM] │ │
│              │   ▸ 2025-06-04  Glucemia ↑       │   │  con burbujas y │ │
│  ...30       │   ▸ 2025-03-20  Tos persistente  │   │  cards de tools │ │
│              │                                  │   └─────────────────┘ │
│              │                                  │                       │
│              │                                  │   [input + voz 🎤]    │
└──────────────┴──────────────────────────────────┴───────────────────────┘
```

Tres columnas no es una regla rígida — si encuentras un layout mejor que
respete los contratos, adelante. Lo importante: **paciente y historia
deben estar visibles siempre** mientras el médico conversa con el asistente.

### Pieza 1 — Banner permanente arriba

**Archivo:** `apps/web/src/app/(shell)/demo/clinical/page.tsx` (al
inicio, fuera de las columnas).

Banner sticky/fixed, no se descarta. Texto:

> ⚠ **Datos sintéticos** — No uses este demo con pacientes reales.
> La base farmacológica es de ejemplo (no certificada).

Sugerencia visual: amarillo de advertencia (`--color-warning` si
existe en el ui-kit; si no, definí uno coherente). Altura compacta,
≤ 36px.

### Pieza 2 — Panel izquierdo: lista de pacientes

**Datos**: `getClinicalPatients({ search?, limit? })` → `{ items, total }`.

**Componentes que esperamos**:

- Input de búsqueda con debounce (300 ms está bien, hay solo 30
  pacientes en el seed, no hay riesgo de carga).
- Lista scrollable de cards. Cada card muestra: nombre, edad, género
  ("M"/"F" → "Hombre"/"Mujer" en UI o íconos), chips de condiciones
  crónicas (las primeras 2, "+1" si hay más).
- Estado seleccionado visualmente claro.
- Counter "30 pacientes" (de `total`).

**Contrato — no romper**:

```tsx
import { getClinicalPatients } from '@/lib/api';
import type { ClinicalPatientSummary } from '@/lib/api';

// La función puede usarse directo en un useEffect + estado local, o con
// un wrapper hook propio (similar a useCorpusPapers). El demo es chico —
// fetch on mount + on search-change es suficiente, no inviertas en cache.

const { items, total } = await getClinicalPatients({ search: 'María' });
// items: ClinicalPatientSummary[]
```

### Pieza 3 — Panel central: historia clínica

**Datos**: `getClinicalPatientDetail(patientId)` → `ClinicalPatientDetail`.

**Cuando montar**: cuando el médico hace click en una card del panel 1.
Antes de eso, mostrar empty state "Selecciona un paciente para ver su
historia".

**Componentes**:

- Header con nombre + edad + género.
- Sección "Datos clínicos relevantes" con chips agrupados: Alergias,
  Condiciones crónicas, Medicación actual. Si una lista está vacía,
  decir "Ninguna registrada" en gris suave, no esconder la sección
  (que el médico vea que se chequeó).
- Sección "Últimas consultas" — lista colapsable (accordion). Cada
  consulta muestra fecha + motivo en el header colapsado; expandida
  muestra examen, diagnóstico, tratamiento, notas.
- Las consultas vienen ordenadas DESC por fecha. No reordenes.

**Contrato — no romper**:

```tsx
import { getClinicalPatientDetail } from '@/lib/api';
import type { ClinicalPatientDetail, ClinicalConsultation } from '@/lib/api';

const patient: ClinicalPatientDetail =
  await getClinicalPatientDetail(patientId);
// patient.consultations: ClinicalConsultation[] (hasta 10, DESC por fecha)
// patient.consultations[i].date es STRING ISO — `new Date(...)` para formatear.
```

### Pieza 4 — Panel derecho: asistente conversacional con tool calls

**Esta es la pieza más rica visualmente.** Es chat + cards de tool
inline.

**Estados**:

- **Sin paciente seleccionado**: empty state "Selecciona un paciente
  para empezar el análisis".
- **Paciente seleccionado, sin pregunta**: panel de sugerencias con 3-4
  preguntas ejemplo (ver "Sugerencias" abajo).
- **Pregunta enviada, streaming**: timeline que crece — burbujas de
  texto + cards de "Consultando interacciones…" + cards de resultado.
- **Done**: input habilitado para siguiente pregunta. (Nota: el backend
  hoy NO mantiene historial conversacional — cada pregunta es
  independiente. Si después agregamos conversación, lo haremos en PR
  aparte; no diseñes para multi-turn.)

**Sugerencias** — armar un componente con estas 4 (mostrar de a 4 o 3,
no más):

1. "¿Puedo recetarle amoxicilina?"
2. "Resume su historia clínica de los últimos 12 meses"
3. "¿Qué diagnóstico diferencial debo considerar?"
4. "¿Su medicación actual tiene interacciones?"

Cuando el médico clickea una sugerencia, se llena el input y se
manda. No es una shortcut — es texto inicial editable.

**Render de la timeline** — el hook `useClinicalAnalyze` ya devuelve
un array de `entries` listo para mapear:

```tsx
import { useClinicalAnalyze } from '@/lib/api';
import type { ClinicalAnalyzeEntry } from '@/lib/api';

const { entries, status, error, start, reset } = useClinicalAnalyze();

// entries es un array discriminado:
entries.map((entry) => {
  switch (entry.kind) {
    case 'text':
      return <Bubble text={entry.text} />; // texto del LLM, va creciendo
    case 'tool_call':
      return (
        <ToolCallCard
          // El LLM consultó interacciones para estas drogas
          medications={entry.medications}
        />
      );
    case 'tool_result':
      return (
        <ToolResultCard
          // Lista (posiblemente vacía) de interacciones encontradas
          interactions={entry.interactions}
        />
      );
  }
});

// Para arrancar:
start({ patientId: selectedPatient.id, question: input });
```

**Visual de las cards de tool**:

- `tool_call`: card colapsada pequeña, ícono de búsqueda + texto
  "Consultando interacciones de: warfarina, ibuprofeno, …" mientras
  el `tool_result` no llegue. Animación de pulse o spinner.
- `tool_result` (con interacciones): card abierta, una fila por
  interacción. Cada fila: drogas (A · B), severidad como pill
  coloreado (`leve` = amarillo suave, `moderada` = naranja, `grave` =
  rojo), descripción en una línea.
- `tool_result` (sin interacciones): card chica verde "✓ No se
  encontraron interacciones conocidas entre estas drogas".

**Contrato — no romper**:

```tsx
// El hook YA maneja: ciclo de vida del SSE, cleanup al desmontar,
// abort si se llama start() de nuevo. No lo dupliques.
//
// `status` es 'idle' | 'streaming' | 'done' | 'error' — usalo para:
// - deshabilitar el botón de enviar mientras streaming
// - mostrar spinner
// - mostrar mensaje de error si === 'error'
```

### Pieza 5 — Voz (placeholder en este PR)

La voz nativa (input + output) entra en **PR siguiente** reusando el
componente del Demo 05. En esta vuelta, **deja un botón de micrófono
deshabilitado** con tooltip "Próximamente — voz disponible en breve".
El botón debe tener su lugar reservado en el input, así el layout no
salta cuando lo activemos.

---

## Banner permanente · texto i18n

i18n strings que necesita el demo. Agregalas a
`apps/web/src/lib/i18n/strings/es.ts` y `en.ts` (existing pattern del
proyecto):

```ts
// es
clinical: {
  title: 'Asistente clínico',
  tagline: 'Apoyo al médico sobre la historia del paciente',
  banner: {
    title: 'Datos sintéticos',
    description: 'No uses este demo con pacientes reales. Base farmacológica de ejemplo.',
  },
  panels: {
    patients: 'Pacientes',
    history: 'Historia clínica',
    assistant: 'Asistente',
  },
  search: {
    placeholder: 'Buscar paciente…',
    empty: 'No hay pacientes que coincidan con la búsqueda.',
    counter: '{{count}} pacientes',
  },
  emptyStates: {
    pickPatient: 'Selecciona un paciente para ver su historia.',
    pickPatientToAnalyze: 'Selecciona un paciente para empezar el análisis.',
  },
  patient: {
    age: '{{age}} años',
    gender: { M: 'Hombre', F: 'Mujer' },
    sections: {
      allergies: 'Alergias',
      chronicConditions: 'Condiciones crónicas',
      currentMedications: 'Medicación actual',
      consultations: 'Últimas consultas',
    },
    none: 'Ninguna registrada',
  },
  consultation: {
    treatingPhysician: 'Médico tratante',
    reasonForVisit: 'Motivo de consulta',
    examFindings: 'Examen físico',
    diagnosis: 'Diagnóstico',
    treatment: 'Tratamiento',
    notes: 'Notas',
  },
  suggestions: {
    title: 'Preguntas frecuentes para empezar',
    items: [
      '¿Puedo recetarle amoxicilina?',
      'Resume su historia clínica de los últimos 12 meses',
      '¿Qué diagnóstico diferencial debo considerar?',
      '¿Su medicación actual tiene interacciones?',
    ],
  },
  input: {
    placeholder: 'Escribe tu pregunta…',
    voiceComingSoon: 'Voz disponible próximamente',
    send: 'Enviar',
  },
  tools: {
    callingInteractions: 'Consultando interacciones de: {{drugs}}',
    noInteractions: 'No se encontraron interacciones conocidas entre estas drogas.',
    interaction: {
      severity: { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' },
    },
  },
  status: {
    streaming: 'Pensando…',
    error: 'Algo salió mal. Intenta de nuevo.',
  },
},
```

Para `en.ts`: traduce de forma natural; el demo se va a presentar en
español, pero mantenemos paridad. Usa terminología médica neutra
("hypertension" no "high blood pressure", etc.).

---

## Lo que tu PR debe incluir

Tu PR de integración cierra el demo de punta a punta. Cinco cosas:

1. **La página** `apps/web/src/app/(shell)/demo/clinical/page.tsx`
   con los 3 paneles y el banner.
2. **Componentes nuevos** bajo `apps/web/src/components/demo/clinical/`
   (cards de paciente, panel de historia, cards de tool, etc.).
3. **i18n** en `apps/web/src/lib/i18n/strings/es.ts` y `en.ts`.
4. **Registro en el catálogo backend**:
   `apps/api/src/app/demos/demo-registry.service.ts` → agregar entry:
   ```ts
   {
     id: 'clinical',
     title: 'Asistente clínico',
     tagline: 'Apoyo al médico sobre la historia del paciente',
     description: '...',
     audience: ['Directores médicos', 'Jefes de servicio', 'CIO de hospital'],
     status: 'available',
     route: '/demo/clinical',
   },
   ```
5. **Habilitar para industria salud**: en
   `packages/db/prisma/seed-tenants.ts` agregar `'clinical'` al array
   `enabledDemos` de la industria `salud`. Yo corro el seed contra
   Railway después del merge para activar en producción.

(Voz queda para el PR siguiente — no te preocupes por integrar Web
Speech API en este PR.)

---

## Contratos rápidos a la mano

Imports que vas a usar:

```ts
import {
  getClinicalPatients,
  getClinicalPatientDetail,
  getClinicalProtocols, // por si haces vista de "biblioteca de protocolos"
  subscribeToClinicalAnalyze, // si no usas el hook
  useClinicalAnalyze, // hook recomendado
} from '@/lib/api';

import type {
  ClinicalAnalyzeEntry,
  ClinicalAnalyzeRequest,
  ClinicalAnalyzeStatus,
  ClinicalConsultation,
  ClinicalInteraction,
  ClinicalInteractionSeverity,
  ClinicalPatientDetail,
  ClinicalPatientSummary,
  ClinicalProtocol,
} from '@/lib/api';
```

Endpoints (Next.js los proxy via rewrite):

| Método | Path                                       | Devuelve                                                                         |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| GET    | `/api/v1/clinical/patients?search=&limit=` | `ClinicalPatientListResponse`                                                    |
| GET    | `/api/v1/clinical/patients/:id`            | `ClinicalPatientDetail`                                                          |
| GET    | `/api/v1/clinical/protocols?category=`     | `ClinicalProtocolListResponse`                                                   |
| POST   | `/api/v1/clinical/analyze` (SSE)           | Stream de eventos `token` / `tool_call` / `tool_result` / `done` / `error_event` |

---

## Smoke test que vas a hacer al cerrar tu PR

Una vez integrado:

1. Login como `admin@nai.local` (superadmin, ve todos los demos).
2. Click en "Asistente clínico" en el sidebar → llega a `/demo/clinical`.
3. Banner amarillo arriba visible.
4. Lista de 30 pacientes carga. Búsqueda "María" filtra.
5. Click en "María Elena Vásquez" → panel central muestra alergias
   (penicilina), condiciones (HTA, DM2), medicación (metformina,
   enalapril, AAS) y consultas previas.
6. Click en sugerencia "¿Su medicación actual tiene interacciones?".
7. Stream del LLM aparece. Card "Consultando interacciones…" con
   warfarina/AAS u otras. Card de resultado con la interacción
   `warfarina + AAS = grave` (María no tiene warfarina; con Manuel
   Yánez sí). Texto final del LLM con cita a la historia.

Si todo eso funciona, el demo está listo para la reunión.

---

## Lo que **NO** hacés en este PR (alcance excluido)

- Carga ad-hoc de pacientes nuevos desde la UI (decisión 3C — fuera del MVP).
- Edición de pacientes / consultas.
- Multi-turn conversation con el asistente (cada pregunta es independiente).
- Vista de "biblioteca de protocolos" como página aparte (puede ir en el
  futuro si lo ves útil; por ahora suficiente que el LLM cite el
  protocolo cuando lo necesita).
- Voz (PR siguiente).
- Cost calculator (no aplica — este demo no tiene proyección de costos
  como el Tutor).

---

## Guardrails de estilo (los mismos del proyecto)

- Español neutro con **"tú"**. Nada de voseo argentino (sin _querés_,
  _podés_, _decís_, _mirá_, _hacé_, _vení_, ni imperativos en `-á/-é/-í`).
- Tokens del ui-kit (`--color-bg`, `--color-fg`, `--space-N`, etc.).
- No emojis salvo el ⚠ del banner.
- Sin librerías nuevas. Lucide para íconos como en el resto del proyecto.

Cuando termines, abrí un PR contra `main` con título
`feat(web): demo 06 — asistente clínico (UI completa)` y avísame.
