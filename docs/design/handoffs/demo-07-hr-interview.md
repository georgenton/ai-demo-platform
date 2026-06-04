# Handoff de diseño — Demo 07 "Avatar entrevistador HR"

> **Cómo usar este documento.** Pasáselo a Claude Design (al inicio de
> una conversación nueva, en el proyecto del design system del AI Demo
> Platform). Continuación del trabajo del Demo 06.
>
> No repetimos contexto de tokens, sistema de design ni layouts del
> ui-kit — solo lo nuevo del Demo 07.

---

## Hola, Claude Design — volvemos

Vamos por el **Demo 07: Avatar entrevistador HR**. Séptimo demo de la
plataforma, primer demo con **IA conversacional con voz pura** sobre
un caso de negocio cross-industry (admisiones universitarias, banca,
retail, gobierno, call centers).

Toda la decisión de alcance está en el **ADR-0017** (en el repo de la
app, `docs/adr/0017-demo-07-hr-interview.md`). Resumen ejecutivo:

| Decisión            | Elegido | Significado para la UI                                                                                                          |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Modalidad input** | **1A**  | Voz pura — el candidato responde solo por mic, **sin teclado**. Requiere Chrome (SpeechRecognition).                            |
| **Origen del rol**  | **2A**  | 6 roles pre-cargados en seed con sus preguntas. La UI los muestra como cards en pantalla de selección; no hay form de creación. |
| **Salida final**    | **3A**  | Scoring por dimensión + recomendación en pantalla. **Sin PDF, sin email.** Persistido en la base para revisión posterior.       |
| **Persistencia**    | **4C**  | Persistimos transcripción literal por respuesta + scoring. Audio queda fuera (Ley de Datos Personales Ecuador).                 |

---

## El pitch del demo en una frase

> "El reclutador elige un rol, registra al candidato y le pasa el equipo.
> El avatar le habla las preguntas una a una; el candidato responde por
> voz; al cerrar, aparece un scoring auditado con citas textuales y una
> recomendación final."

**Audiencia objetivo**: directores de RRHH, jefes de selección,
admisiones universitarias, gerentes operativos. La emoción que tiene que
provocar el demo: "esto reduce 20 horas/semana de entrevistas de primer
filtro a 0, y la decisión final del humano queda mejor informada".

---

## Estado del backend (lo que ya está hecho)

| Pieza                                                           | Estado                                            |
| --------------------------------------------------------------- | ------------------------------------------------- |
| Schema Prisma + migración (Job, JobQuestion, Interview, Answer) | Listo (PR #85)                                    |
| Seed corrido en Railway (6 roles, 31 preguntas)                 | Listo                                             |
| Endpoints `/api/v1/hr/*` montados                               | Listos (PR #86) — gateados por demo no habilitado |
| Tool calling `score_dimension` + `final_recommendation`         | Listo                                             |
| Tipos TypeScript del frontend                                   | Listos (este PR)                                  |
| Cliente HTTP + SSE                                              | Listos (este PR)                                  |
| Hook `useInterviewSession`                                      | Listo (este PR)                                   |

**El demo aún no aparece en el sidebar** porque `'interview'` no está
en `enabledDemos` de ninguna industria. Tu PR final agrega:

- el demo al `demo-registry.service.ts` (backend),
- `'interview'` a las industrias correspondientes en `seed-tenants.ts`.

---

## El trabajo, en un solo bloque

Una página, tres pantallas (una por phase del flujo). Va en un solo PR
cerrando todo el demo de punta a punta.

### Flujo de pantallas

```
┌──────────────────────────────────────────────────────────────────────┐
│  PANTALLA 1 — Selección de rol + candidato                            │
│  (phase: 'idle')                                                      │
│                                                                       │
│  Grid de 6 cards de roles. Click → forma de candidato                │
│  inline con: Nombre + Cédula (opcional) + botón "Iniciar entrevista". │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ start({ jobId, candidateName, ... })
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PANTALLA 2 — Entrevista en vivo                                      │
│  (phase: 'interviewing')                                              │
│                                                                       │
│   Header: nombre del rol · nombre candidato · progreso "2 / 5"        │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                                                              │    │
│   │           [ Avatar / ilustración minimalista ]               │    │
│   │                                                              │    │
│   │           Texto de la pregunta — grande, centrado             │    │
│   │                                                              │    │
│   │     "Cuéntame de un proyecto donde tuviste que aprender…"     │    │
│   │                                                              │    │
│   │           [ ▶ Repetir pregunta ]                              │    │
│   │                                                              │    │
│   │  ┌────────────────────────────────────────────────────────┐ │    │
│   │  │  Transcripción en vivo (mientras el candidato habla)   │ │    │
│   │  │  "Trabajé en una API de pedidos para una empresa de…"  │ │    │
│   │  └────────────────────────────────────────────────────────┘ │    │
│   │                                                              │    │
│   │   ┌───────────────────────────┐  ┌────────────────────────┐  │    │
│   │   │  [ Volver a grabar ]      │  │  [ Confirmar y seguir ] │  │    │
│   │   └───────────────────────────┘  └────────────────────────┘  │    │
│   │                                                              │    │
│   │              [ ● Botón mic (gigante, central) ]              │    │
│   │                                                              │    │
│   └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ todas las preguntas respondidas
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PANTALLA 2b — Cierre + finalizar                                     │
│  (phase: 'ready_to_finalize')                                         │
│                                                                       │
│   "Has completado las 5 preguntas. Vamos a generar la evaluación."    │
│   [ Generar evaluación ]                                              │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ finalize()
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PANTALLA 3 — Resultado                                               │
│  (phase: 'finalizing' → 'finalized')                                  │
│                                                                       │
│   Header: candidato · rol · recomendación final con badge de color    │
│                                                                       │
│   Score global: 78 / 100                                              │
│   Recomendación: HIRE                                                 │
│                                                                       │
│   [ Cards de dimensiones — aparecen 1 a 1 mientras llegan los SSE ]   │
│                                                                       │
│   ┌─ Claridad ────────────────── 85/100 ─┐                             │
│   │  "Estructuré mi respuesta primero    │                             │
│   │   leyendo docs, luego haciendo…"     │                             │
│   └──────────────────────────────────────┘                             │
│                                                                       │
│   ┌─ Conocimiento técnico ─────── 72/100 ─┐                             │
│   │  "Mencionó verbos GET/POST y…"        │                             │
│   └──────────────────────────────────────┘                             │
│                                                                       │
│   FORTALEZAS:                                                         │
│   <párrafo de 2-3 oraciones>                                          │
│                                                                       │
│   OPORTUNIDADES:                                                      │
│   <párrafo de 2-3 oraciones>                                          │
│                                                                       │
│   [ Volver al inicio ]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Pieza 1 — Selección de rol

**Datos**: `getHrJobs()` → `{ items: HrJobSummary[], total: number }`.

**Componentes esperados**:

- Hero corto: "Selecciona el rol que vas a entrevistar".
- Grid de 6 cards (3 col x 2 fila en desktop, 2x3 en tablet, 1x6 en mobile).
- Cada card: título + descripción (truncada a 3 líneas) + chips con dimensiones (primeras 3) + "X preguntas".
- Click en una card → la marca como seleccionada → aparece el form inline.

**Form de candidato** (inline debajo de la card seleccionada o en modal):

- Input `Nombre del candidato` (required).
- Input `Cédula / ID externo` (opcional).
- Botón "Iniciar entrevista" → llama `start({ jobId, candidateName, candidateExternalId })`.

**Contrato — no romper**:

```tsx
import { getHrJobs, useInterviewSession } from '@/lib/api';
import type { HrJobSummary } from '@/lib/api';

const { items } = await getHrJobs();

// Cuando el user hace click en "Iniciar entrevista":
const { start } = useInterviewSession();
await start({
  jobId: selected.id,
  candidateName,
  candidateExternalId: cedula || undefined,
});
```

---

## Pieza 2 — Entrevista en vivo

**Datos**: el hook `useInterviewSession` provee todo el estado.

**Componentes esperados**:

- **Header** sticky con: badge del rol + nombre del candidato + barra de progreso "1/5" (usa `answeredCount` y `totalQuestions`).
- **Pregunta** en cuerpo grande (font-size: ~28px), centrada. Botón "Repetir pregunta" usa `useSpeechSynthesis` para que el avatar la diga de nuevo.
- **Botón mic gigante** (~80px diámetro, animación de pulse cuando está grabando). Estados: idle / listening / unsupported (browser sin SpeechRecognition).
- **Transcripción en vivo** debajo del mic. Mientras `recognition.isListening`, muestra `interimTranscript`; cuando termina, muestra el `transcript` final.
- **Acciones después de grabar**:
  - "Volver a grabar" → resetea el transcript y vuelve al mic idle.
  - "Confirmar y seguir" → llama `submitAnswer({ transcript, durationSeconds })`.
- Si `phase === 'ready_to_finalize'`, reemplaza la pantalla por la pantalla 2b ("Vamos a generar la evaluación").

**Voz nativa** — el componente shared ya está consolidado en
`components/shared/voice/`:

```tsx
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from '@/components/shared/voice';

// El reclutador puede configurar el idioma de la entrevista en el form de
// selección del rol (default 'es-ES'). Por ahora hardcodea 'es-ES'.
const recognition = useSpeechRecognition({ lang: 'es-ES' });
const synthesis = useSpeechSynthesis({ lang: 'es-ES' });

// Cuando la pregunta cambia, hablarla automáticamente:
useEffect(() => {
  if (currentQuestion && synthesis.isSupported) {
    synthesis.speak(currentQuestion.text);
  }
}, [currentQuestion, synthesis]);

// Cuando llega un transcript final, ofrecer "Confirmar":
useEffect(() => {
  if (recognition.transcript) {
    setFinalTranscript(recognition.transcript);
    recognition.reset();
  }
}, [recognition.transcript]);

// Confirmar:
async function handleConfirm() {
  await submitAnswer({
    transcript: finalTranscript,
    durationSeconds: durationFromMicStartStop,
  });
  setFinalTranscript('');
}
```

**Tip para que el demo se sienta real**: medir `durationSeconds` con
`performance.now()` entre `recognition.start()` y `recognition.stop()`. Es
un detalle que el reclutador nota y mejora la sensación de "esto es serio".

---

## Pieza 3 — Pantalla de resultado

**Datos**: el hook expone `dimensions: HrDimensionScored[]` (se va
poblando incrementalmente durante `phase === 'finalizing'`) + `final:
HrFinalResult | null` (poblado cuando llega el evento `final` del SSE).

**Estados**:

- `phase === 'finalizing'`: spinner + texto "Generando evaluación…". Las cards de dimensión van apareciendo a medida que llegan los eventos `dimension_scored` (animación de slide-in).
- `phase === 'finalized'`: todas las dimensiones + recomendación + fortalezas + oportunidades + botón "Volver al inicio".

**Componentes esperados**:

- **Header de resultado**: nombre del candidato + rol + badge grande de la recomendación con color (`hire` = mint, `reconsider` = amber, `reject` = crimson).
- **Score global** prominente (font-size grande con barra de progreso).
- **Grid de cards de dimensión** (1 col mobile, 2 cols desktop). Cada card:
  - Nombre de la dimensión.
  - Score como número grande + chip de tono (`bad` = crimson, `neutral` = amber, `good` = mint).
  - Evidencia entre comillas en italics: `"Mi respuesta sobre la API…"`.
- **Sección "Fortalezas"** con párrafo.
- **Sección "Oportunidades"** con párrafo.
- Botón "Volver al inicio" → llama `reset()` del hook.

**Cómo derivar el tono visual del score**:

```ts
function scoreToTone(score: number): 'bad' | 'neutral' | 'good' {
  if (score < 50) return 'bad';
  if (score < 70) return 'neutral';
  return 'good';
}
```

**Recomendación → color**:

```ts
// hire    → var(--nai-mint-500)
// reconsider → var(--nai-amber-500)
// reject  → var(--nai-crimson-500)
```

---

## Pieza 4 — Auditoría obligatoria (banner)

Sobre la pantalla del resultado (header sticky o banner pequeño), texto
explícito:

> ⓘ El scoring es generado por IA y debe ser revisado por un reclutador
> humano antes de tomar una decisión de contratación.

Esto NO es opcional — es parte del compromiso anti-bias del demo. El
backend ya lo fuerza en el system prompt; el frontend lo refuerza
visualmente. Sugerencia visual: misma estética del banner clínico
("Datos sintéticos") pero con texto distinto.

---

## Strings i18n

Estas son las claves que se agregan a `apps/web/src/lib/i18n/strings.ts`
(ES + EN). Tu PR final las incluye:

```ts
// es
interview: {
  title: 'Avatar entrevistador',
  tagline: 'Entrevistas estructuradas con scoring auditado',
  audit: {
    text: 'El scoring es generado por IA y debe ser revisado por un reclutador humano antes de tomar una decisión de contratación.',
  },
  selectRole: {
    title: 'Selecciona el rol que vas a entrevistar',
    subtitle: '6 roles seedeados con preguntas adaptadas a cada perfil.',
    counter: '{n} roles',
    questionsCount: '{n} preguntas',
  },
  candidateForm: {
    title: 'Datos del candidato',
    nameLabel: 'Nombre del candidato',
    namePlaceholder: 'Ej. Juan Pérez',
    cedulaLabel: 'Cédula o ID externo (opcional)',
    cedulaPlaceholder: 'Ej. 1717182632',
    start: 'Iniciar entrevista',
    starting: 'Preparando entrevista…',
  },
  interview: {
    progress: 'Pregunta {n} de {total}',
    repeat: 'Repetir pregunta',
    micStart: 'Hablar',
    micStop: 'Detener',
    micUnsupported: 'Tu navegador no soporta voz. Usa Chrome.',
    transcriptHint: 'Esto es lo que el sistema entendió. Puedes regrabar o confirmar.',
    rerecord: 'Volver a grabar',
    confirm: 'Confirmar y seguir',
    confirming: 'Guardando respuesta…',
  },
  readyToFinalize: {
    title: 'Has completado las {n} preguntas.',
    subtitle: 'Vamos a generar la evaluación del candidato.',
    finalize: 'Generar evaluación',
  },
  result: {
    finalizing: 'Generando evaluación…',
    finalizingHint: 'El sistema está analizando cada respuesta. Las dimensiones aparecerán a medida que se evalúen.',
    overall: 'Score global',
    recommendation: {
      hire: 'Recomendado',
      reconsider: 'Vale otra mirada',
      reject: 'No recomendado',
    },
    dimensions: 'Dimensiones evaluadas',
    strengths: 'Fortalezas',
    opportunities: 'Oportunidades de mejora',
    restart: 'Volver al inicio',
  },
  error: {
    title: 'Algo salió mal',
    restart: 'Volver al inicio',
  },
},
```

Para EN: traduce de forma natural manteniendo terminología neutra de
RRHH (`hire` / `reconsider` / `reject`).

---

## Lo que tu PR debe incluir

Tu PR de integración cierra el demo de punta a punta. Cinco cosas:

1. **La página** `apps/web/src/app/(shell)/demo/interview/page.tsx` con las 3 pantallas (selección de rol, entrevista en vivo, resultado).
2. **Componentes nuevos** bajo `apps/web/src/components/demo/interview/` (cards de rol, mic gigante con estados, cards de dimensión, header de resultado, etc.).
3. **i18n** en `apps/web/src/lib/i18n/strings.ts` (`interview.*` + `audience.interview.*` + entrada en `demos.interview.*`).
4. **Registro en el catálogo backend**:
   `apps/api/src/app/demos/demo-registry.service.ts` → agregar entry:
   ```ts
   {
     id: 'interview',
     title: 'Avatar entrevistador',
     tagline: 'Entrevistas estructuradas con scoring auditado',
     description: '...',
     audience: ['Directores de RRHH', 'Jefes de selección', 'Admisiones universitarias'],
     status: 'available',
     route: '/demo/interview',
   }
   ```
5. **Habilitar para varias industrias**: en `packages/db/prisma/seed-tenants.ts` agregar `'interview'` a `enabledDemos` de **universidad**, **banca**, **retail**, **gobierno** (es cross-industry — no salud, no legal).

(También suma `'interview'` al union `DemoId` en `apps/web/src/lib/api/types.ts` + el catalog del frontend `lib/catalog/demos.ts` con icon `'mic'` o `'circle-user'`.)

---

## Contratos rápidos a la mano

```ts
import { getHrJobs, useInterviewSession } from '@/lib/api';
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from '@/components/shared/voice';

import type {
  HrJobSummary,
  HrQuestion,
  HrDimensionScored,
  HrFinalResult,
  InterviewPhase,
} from '@/lib/api';
```

**Endpoints (Next.js los proxy via rewrite)**:

| Método | Path                                       | Devuelve                                                                |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| GET    | `/api/v1/hr/jobs`                          | `HrJobListResponse`                                                     |
| GET    | `/api/v1/hr/jobs/:id`                      | `HrJobSummary`                                                          |
| POST   | `/api/v1/hr/interviews`                    | `HrCreateInterviewResponse`                                             |
| GET    | `/api/v1/hr/interviews/:id/next-question`  | `HrNextQuestionResponse`                                                |
| POST   | `/api/v1/hr/interviews/:id/answer`         | `{ ok: true }`                                                          |
| POST   | `/api/v1/hr/interviews/:id/finalize` (SSE) | Stream de eventos `dimension_scored` · `final` · `done` · `error_event` |

**`useInterviewSession` API**:

```ts
const {
  phase, // 'idle' | 'starting' | 'interviewing' | 'ready_to_finalize' | 'finalizing' | 'finalized' | 'error'
  interviewId,
  jobTitle,
  totalQuestions,
  answeredCount,
  currentQuestion, // HrQuestion | null
  dimensions, // HrDimensionScored[] — se acumula incremental
  final, // HrFinalResult | null
  error,
  start, // (body) => Promise<void>
  submitAnswer, // ({ transcript, durationSeconds }) => Promise<void>
  finalize, // () => void
  reset, // () => void
} = useInterviewSession();
```

---

## Smoke test que vas a hacer al cerrar tu PR

1. Login como `admin@nai.local` (superadmin, ve todos los demos).
2. Click en "Avatar entrevistador" en el sidebar → llega a `/demo/interview`.
3. Ve los 6 cards de roles.
4. Click en "Desarrollador junior backend" → form de candidato.
5. Escribe "Juan Pérez" + click "Iniciar entrevista".
6. La pantalla muestra la primera pregunta y el avatar la dice por TTS.
7. Click mic → habla 30 segundos.
8. El transcript aparece debajo. Click "Confirmar y seguir".
9. Repite hasta completar las 5 preguntas.
10. Click "Generar evaluación".
11. Las cards de dimensión aparecen una por una (claridad, conocimiento técnico, capacidad de aprendizaje, motivación).
12. Aparece la recomendación final (hire/reconsider/reject) con fortalezas + oportunidades.
13. Click "Volver al inicio" → vuelve a la pantalla de selección.

Si pasa, el demo está listo para la reunión.

---

## Lo que NO entra en este alcance

- Upload de JD por PDF (decisión 2A — fuera del MVP).
- Generación de PDF descargable del resultado (decisión 3A).
- Email automático al reclutador (decisión 3C descartada).
- Historial de entrevistas del mismo candidato (cada Interview es independiente).
- Avatar 3D / video sintético (descartado en el ADR-0017).
- Cost calculator (no aplica — este demo no proyecta costos como el Tutor).

---

## Guardrails de estilo (los mismos del proyecto)

- Español neutro con **"tú"**. Nada de voseo argentino.
- Tokens del ui-kit (`--color-bg`, `--color-fg`, `--space-N`, etc.).
- Sin librerías nuevas. Lucide para íconos.
- Mint NAI por default; el reclutador puede tener branding custom.
- Sin emojis salvo el ⓘ del banner de auditoría.

Cuando termines, empaquetá el delta y pasámelo. Yo lo integro al
Next.js real, corro el seed-tenants contra Railway para activar el
demo, y hago smoke test en producción.
