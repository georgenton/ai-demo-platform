# Handoff — AI Demo Platform (Diseño → Claude Code)

> Paquete de entrega para implementar el diseño del **AI Demo Platform** (demos
> de IA empresarial corriendo sobre Nutanix Enterprise AI on-premise) en el
> repositorio `georgenton/ai-demo-platform`.

---

## 0. Qué hay en este paquete

```
design_handoff_ai_demo_platform/
├── README.md                  ← este archivo (empezá acá)
├── CLAUDE_CODE_PROMPT.md      ← prompt listo para pegar en Claude Code
├── DESIGN_SYSTEM.md           ← documentación completa del sistema de diseño
├── SKILL.md                   ← manifiesto de skill (Claude Design / Code)
├── colors_and_type.css        ← TODOS los tokens (colores, tipos, espacios, motion, sombras)
├── assets/                    ← logos (mark + wordmark, light + dark)
└── ui_kit_web/                ← UI kit completo en React + HTML
    ├── index.html             ← abrí esto en el browser para ver TODO el producto
    ├── ui-kit.css             ← clases de componente (.btn, .card, .bubble, .agent-event...)
    ├── i18n.jsx               ← strings ES + EN (fuente de verdad de copy)
    ├── data.jsx               ← catálogo + fake-data factories
    ├── ui.jsx                 ← primitives (Button, Badge, Pill, Card, Icon, Modal, SqlBlock...)
    ├── Shell.jsx              ← app shell (sidebar + header)
    ├── DemoRag.jsx            ← Demo 01 — RAG chat con documentos
    ├── DemoComparator.jsx     ← Demo 02 — comparador de documentos
    ├── DemoCorpus.jsx         ← Demo 03 — teaser de corpus académico
    ├── DemoAgent.jsx          ← Demo 04 — agente con SQL
    └── README.md              ← mapping de cada archivo al repo real Next.js
```

---

## 1. Sobre los archivos de diseño

**Los archivos en `ui_kit_web/` son referencias de diseño, no código de
producción.** Son prototipos en HTML + React (vía Babel standalone) que muestran
el look, copy, densidad y movimiento finales. La tarea del developer es
**recrear estos diseños dentro del Next.js app del repo `ai-demo-platform`**,
respetando:

- la arquitectura existente (`apps/web/src/app/...`)
- los contratos de API (`apps/web/src/lib/api/*` — fuente de verdad para
  endpoints, tipos, hooks de streaming)
- las convenciones del `CLAUDE.md` del repo

`colors_and_type.css` **sí se puede usar directamente** — está pensado como
fundación de tokens para drop-in en el proyecto Next.js.

---

## 2. Fidelidad

**High-fidelity (hifi).** Los mocks son pixel-perfect: colores, tipografía,
espaciados, radios, sombras, hover/focus/press y animaciones de streaming están
definidas hasta el detalle. El developer debe recrear la UI tal cual, usando los
tokens semánticos de `colors_and_type.css` y las clases de `ui-kit.css`.

---

## 3. Cómo abrir y revisar el diseño

```bash
# desde la carpeta del handoff
open ui_kit_web/index.html
# (o servila con cualquier static server si tu browser bloquea babel-standalone)
```

Lo que vas a ver:

- Sidebar con las 4 demos
- Header sticky con switch ES/EN y toggle light/dark
- Las 4 pantallas interactivas (RAG, Comparator, Corpus, Agent) con streaming
  fake para ver la animación canónica

---

## 4. Pantallas (overview rápido)

Para detalle por pantalla, ver `DESIGN_SYSTEM.md` y los JSX individuales.

| Demo              | Archivo de referencia           | Propósito                                                               |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------- |
| **01 RAG**        | `ui_kit_web/DemoRag.jsx`        | Sube PDF → indexa → chat con citas inline                               |
| **02 Comparator** | `ui_kit_web/DemoComparator.jsx` | Subí 2 docs, elegí dimensiones, recibí análisis en markdown streamed    |
| **03 Corpus**     | `ui_kit_web/DemoCorpus.jsx`     | Teaser "coming soon" con roadmap (no es placeholder — es value prop)    |
| **04 Agent**      | `ui_kit_web/DemoAgent.jsx`      | Consola 3 columnas: pregunta → eventos (SQL → result → answer) → schema |

Cada demo mapea 1:1 a una ruta del repo:

| UI kit file          | Next.js path                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `DemoRag.jsx`        | `apps/web/src/app/demo/rag/page.tsx`                                               |
| `DemoComparator.jsx` | `apps/web/src/app/demo/comparator/page.tsx`                                        |
| `DemoCorpus.jsx`     | `apps/web/src/app/demo/corpus/page.tsx`                                            |
| `DemoAgent.jsx`      | `apps/web/src/app/demo/agent/page.tsx`                                             |
| `Shell.jsx`          | `apps/web/src/app/layout.tsx` + `components/Sidebar.tsx` + `components/Header.tsx` |
| `ui.jsx` primitives  | `apps/web/src/components/ui/*`                                                     |

---

## 5. Design tokens (resumen)

Todo en `colors_and_type.css`. Tres capas:

1. **Base** — colores crudos: `--nai-navy-800`, `--nai-mint-500`, `--nai-ink-600`, etc.
2. **Semantic** — `--color-bg`, `--color-fg-muted`, `--color-accent`, etc. (auto-flip dark).
3. **Componente** — height, gap, radius por componente.

### Brand colors

- **Navy** `#142b4b` (`--nai-navy-800`) — superficie primaria, dark mode foundation
- **Mint** `#43c194` (`--nai-mint-500`) — accent "IA está trabajando", success, streaming cursor
- **Paper** `#fbfbfa` — fondo cálido off-white de la app
- **Amber** `#e08a1f` — warnings, estado "pensando"
- **Crimson** `#d23456` — destructivo, error

### Type

- **IBM Plex Sans** — body, UI, headings (Google Fonts)
- **IBM Plex Mono** — código, SQL, citas, IDs, KICKERs
- **IBM Plex Serif** — solo en `.citation` (fragmentos verbatim de docs)
- Escala modular 1.2 anclada en 16 px
- Display sizes (`--text-4xl`+) usan `letter-spacing: -0.03em`

### Spacing

- Escala 4 px (`--space-1`…`--space-24`)
- Sidebar `--sidebar-w: 264px`, header `--header-h: 56px`
- Cards capean a 1200 px (working) / 1440 px (analytics)
- Padding mínimo interno de card: `--space-6`

### Radii

`2 → 4 → 6 → 10 → 16 → 20 → 999`. Cards = `--radius-lg` (10), buttons = `--radius-md` (6), pills = `--radius-pill`.

### Motion

- Easing default: `--ease-out` (`cubic-bezier(0.2, 0.7, 0.2, 1)`)
- Duraciones: `80ms` / `150ms` / `220ms` / `400ms`
- **Streaming** = animación firma: token-by-token + cursor mint que parpadea a 1.1 s
- **No spinners.** Skeleton shimmer (1.6 s loop) o texto descriptivo ("Indexando…")

---

## 6. Interacciones canónicas

| Patrón                                 | Comportamiento                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Streaming de respuesta LLM**         | Tokens aparecen char-by-char en `.bubble.assistant`. Cursor mint (`.stream-cursor`) al final. NO spinners.                                            |
| **Materialización de cards de agente** | 220 ms ease-out desde `opacity:0; translateY(6px) scale(0.99)` → identity                                                                             |
| **Hover**                              | Background → `--color-surface-hover`. Sin scale, sin shadow, sin glow. Border + 1 step.                                                               |
| **Press**                              | Background → `--color-surface-active`. `translateY(0.5px)` en raised buttons.                                                                         |
| **Focus**                              | Outer ring 3 px `--shadow-focus` (navy light / mint dark). Nunca quitar outline.                                                                      |
| **Disabled**                           | `opacity: 0.5`, `cursor: not-allowed`, sin hover.                                                                                                     |
| **Citations**                          | OBLIGATORIO cuando el LLM referencia un doc. Formato: `Reglamento académico, art. 14`. Estilo: `.citation-inline` (mono, navy-700, underline-dotted). |

---

## 7. Reglas duras (no negociables)

1. **Bilingüe ES/EN en paralelo.** Todo string en `i18n.ts` (port de
   `ui_kit_web/i18n.jsx`) bajo `STRINGS.es` y `STRINGS.en`. Switch en el header,
   persistido a `localStorage` (`adp-lang`). Spanish es source of truth para
   tono/ritmo. Nunca hardcodear copy.
2. **Sentence case en TODO.** Botones, headings, menús, badges. Nunca Title
   Case, nunca ALL CAPS (excepto `.eyebrow` / KICKER).
3. **No emoji en product UI.** Estado vía Lucide icons + color, jamás emoji.
4. **No gradientes decorativos.** Dos excepciones documentadas: hero radial
   dark mode + fade en streams largos.
5. **Streaming-first.** Cuando el LLM produce output, mostrar token-by-token con
   cursor mint. Nunca un spinner genérico.
6. **Iconos = Lucide solamente.** `lucide-react` dependency. Stroke 1.5 px @
   24 px, outline only, rounded caps. Nunca hand-rolled SVG.
7. **Surfaces flat + border 1 px.** Sombras solo para floating (menus, modals,
   toasts). Cards en reposo NO tienen shadow.
8. **Navy + mint son load-bearing.** Nunca sustituir por azul / púrpura genérico.

---

## 8. State management (por pantalla)

### RAG (`DemoRag.jsx`)

- `documents: Document[]` — lista de docs indexados (server source)
- `selectedDocId: string | null`
- `messages: Message[]` — historial de chat
- `streaming: boolean` + buffer del token en curso
- API: `listDocuments()`, `uploadDocument(file)`, `deleteDocument(id)`,
  `useChatStream({ docId, query })`

### Comparator (`DemoComparator.jsx`)

- `step: 1 | 2 | 3` — wizard de 3 pasos
- `docA, docB: Document | null`
- `dimensions: string[]` — checkboxes (con presets lang-aware en `i18n.jsx`)
- `output: string` — markdown streamed
- API: `subscribeToCompare({ docAId, docBId, dimensions })`

### Corpus (`DemoCorpus.jsx`)

- Estática. Roadmap items hardcoded en JSX (3 done / 1 current / 2 upcoming).

### Agent (`DemoAgent.jsx`)

- `activeTab: 'console' | 'history'`
- `question: string`
- `events: AgentEvent[]` — `{type: 'sql'|'result'|'answer', payload, ts}`
- `streaming: boolean`
- `history: HistoryRow[]`
- API: `subscribeToAgent({ question })` → SSE de eventos

---

## 9. Assets

- `assets/logo-mark.svg` + `logo-mark-on-dark.svg` — mark cuadrado (3 nodos mint
  → square white = RAG metaphor). **Flagged**: placeholder propuesto, puede
  evolucionar.
- `assets/logo-wordmark.svg` + `logo-wordmark-on-dark.svg` — lockup mark + texto.
- No hay fotos / ilustraciones de personas / stock. Si se necesita imagery,
  seguir guideline en `DESIGN_SYSTEM.md` → "Imagery".

---

## 10. Stack y conventions del repo destino

Confirmadas en el `CLAUDE.md` del source repo (`georgenton/ai-demo-platform`):

- **Frontend:** Next.js (app router) en `apps/web/`
- **Lang:** TypeScript
- **Styles:** drop `colors_and_type.css` como global y usar `@apply` o vanilla
  CSS modules. (NO usar Tailwind a menos que el repo ya lo tenga configurado —
  verificar `apps/web/package.json` primero.)
- **Icons:** instalar `lucide-react`
- **Fuentes:** ya cargan vía `@import` en `colors_and_type.css` (Google Fonts).
  Si querés self-host, droppealas en `apps/web/public/fonts/` y reemplazá el
  `@import` con `@font-face`.
- **API:** `apps/web/src/lib/api/*` es la fuente de verdad para endpoints +
  hooks. NO inventar contratos — leerlos primero.

---

## 11. Caveats abiertos

Antes de cerrar un PR, confirmar con el owner del producto (Jorge):

- Logo mark es placeholder propuesto. Si llega identidad real, swap en
  `assets/` y actualizar `DESIGN_SYSTEM.md`.
- IBM Plex se carga desde Google Fonts CDN. Si se compra una licencia real de
  type, droppear archivos en `apps/web/public/fonts/`.
- Lucide se eligió porque el repo no tenía sistema de iconos. Si el cliente
  quiere otra librería (Phosphor, Tabler), el mapping en `DESIGN_SYSTEM.md` →
  "Iconography" es 1:1 trasladable.

---

## 12. Cómo usar este handoff en Claude Code

1. Cloná `georgenton/ai-demo-platform` localmente.
2. Copiá esta carpeta entera (`design_handoff_ai_demo_platform/`) a la raíz del
   repo o adentro de `docs/`.
3. Abrí Claude Code en la raíz del repo.
4. Pegá el contenido de **`CLAUDE_CODE_PROMPT.md`** como primer mensaje.
5. Claude Code va a leer este README + el ui_kit, planificar la migración por
   pantalla, y empezar a implementar contra las rutas Next.js reales.

---
