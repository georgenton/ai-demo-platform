# AI Demo Platform — Design System

A design system for the **AI Demo Platform**, a series of enterprise-AI demos that
run on **Nutanix Enterprise AI (NAI)** on-premise hardware. The product is shown
live to potential clients in Ecuador — universities and large companies who are
evaluating buying NAI to run LLMs on their own infrastructure (no data leaves
their network).

Audience watching the demos: rectors, vice-rectors, CIOs, deans, legal /
procurement directors. Mostly non-technical decision makers. The presenter is
the Nutanix sales rep and the technical architect.

This design system is consumed by **Claude Design** (where the UI is built) and
fed back to **Claude Code** (where the backend lives). The split is documented in
the source repo's `CLAUDE.md`.

---

## Source materials

This system was built from one input repository. The Figma file and a real
brand identity do not exist yet — the design language defined here is intended
to **become** the brand:

- **`georgenton/ai-demo-platform`** — <https://github.com/georgenton/ai-demo-platform>
  - `CLAUDE.md` — full project context (commercial goals, stack, conventions)
  - `apps/web/src/app/global.css` — early color hints (navy hero, mint accent)
  - `apps/web/src/app/demo/rag/page.tsx` — debug scratchpad UI (not production)
  - The README, `packages/llm-adapter`, `packages/rag-core`, `packages/db` give
    the technical vocabulary used throughout copy

A second, much richer brief was provided by the project owner (Jorge) describing
the 4 demos in detail. That brief is embedded in this system's UI kit and copy.

Readers with access to the GitHub repo should open it directly for canonical
source of truth on the API contracts, demo specs, and stack decisions. The
client lib under `apps/web/src/lib/api/` is the authoritative source for every
hook and endpoint signature the UI calls.

---

## At a glance

- **Brand line:** _AI Demo Platform — Powered by Nutanix Enterprise AI_
- **Language:** Spanish (Ecuadorian-neutral) and English, switchable in-app via the ES / EN segmented control in the header. Spanish is the default for the live demo; English is offered for international stakeholders and for documentation contexts.
- **Tone:** technical-confident, enterprise-serious, never playful — closer to Vercel / Linear / Anthropic Console than to a hackathon project
- **Palette:** deep navy as foundation, mint as the "AI is working" accent, warm off-white paper
- **Type:** IBM Plex Sans / Mono / Serif — engineered, technical, humanist enough to feel warm in Spanish prose
- **Modes:** light (daytime meetings) and dark (auditorium / projector)

---

## Content fundamentals

This product is sold by a presenter to a non-technical executive audience while
the demo runs on screen behind them. Copy has to **carry credibility without
explaining itself**.

### Two languages, one voice

The UI ships with **ES** and **EN** in parallel — both fully translated, both
held to the same standards. The presenter toggles in real time via the ES / EN
segmented control in the header; the choice is persisted to `localStorage` so a
reload keeps the audience's language.

**Spanish is the source of truth** for tone and rhythm. English translations
mirror the Spanish in concision and concreteness — they are not "American
marketing copy", they are the same voice in English. When a string is hard to
translate without losing punch, prefer rewriting in English to match the
_feeling_ rather than transliterating word-for-word.

All user-facing strings live in `ui_kits/web/i18n.jsx` under a flat key
namespace (`rag.title`, `cmp.step1.label`, `agent.kicker.sql`, etc.). When
adding a new string, add it to **both** `STRINGS.es` and `STRINGS.en` in the
same commit. Fallback behaviour: missing keys render as the key name, so a
forgotten translation is loud and visible.

### Voice

- **Confident, not boastful.** "Indexamos el documento" — not "¡Indexamos el documento exitosamente!". No exclamation marks except in rare empty-state encouragement.
- **Concrete, not abstract.** "El agente generó esta SQL y la ejecutó en 23 ms" beats "El sistema procesó tu consulta".
- **Brief.** UI strings rarely exceed 8 words. Buttons are 1–3 words.
- **Bilingual-safe technical terms.** Spanish where common ("documento", "fragmento", "consulta", "respuesta", "cargar"). English for jargon that is jargon in Spanish too ("SQL", "API", "embedding", "chunk" → "fragmento", "stream" → "stream" in tech contexts, "RAG").

### Casing

- **Sentence case everywhere.** Buttons, headings, menus, badges. Never Title Case. Never ALL CAPS except for KICKER / EYEBROW labels.
- Acronyms keep their case: `SQL`, `API`, `LLM`, `PDF`, `NAI`.
- Product name: **AI Demo Platform**. Always written with the spaces and capital letters as shown — not `aidemoplatform` or `AIDemoPlatform`.

### Person & address

- **"vos" / "tú" is fine; default to neutral "tú"** for written copy. Buttons stay infinitive: "Subir documento", "Generar análisis".
- Never "usted" — too formal for a tool. Never "us" / "nosotros" speaking for the system — the system has no opinions.

### Examples

| ❌ Don't                                          | ✅ Do                                                      |
| ------------------------------------------------- | ---------------------------------------------------------- |
| "¡Documento subido con éxito! 🎉"                 | "Documento indexado — 12 fragmentos"                       |
| "Por favor introduzca su consulta a continuación" | "Pregunta sobre el documento…"                             |
| "Algo salió mal :("                               | "No pude generar la respuesta. Reintenta o revisa el log." |
| "Sube tu archivo PDF aquí 📄"                     | "Arrastra un PDF o haz clic para subir"                    |
| "Procesando..."                                   | "Indexando…" / "Generando SQL…" / "Leyendo resultados…"    |

### Emoji

**Not used in the product UI.** Status communicated via icons + color, never via
emoji. The only place emoji is acceptable is in documentation / commit messages
inside the source repo, which is out of scope here.

### Numbers, units, dates

- Spanish formatting: `23 ms`, `1.247 documentos` (period as thousands), `0,87` (comma as decimal).
- Relative time for recency: "hace 2 minutos", "hace 3 días". Absolute for archival: "23 oct 2025, 14:32".
- Always show units with a space: `12 MB`, `5 fragmentos`, `200 ms`.

### Microcopy patterns

- **Empty states** invite the next action, never apologize: "Subí tu primer documento para empezar".
- **Loading states** describe the work, not "loading…": "Indexando…", "Buscando fragmentos relevantes…", "Generando SQL…".
- **Errors** state what happened + what to do: "No pude leer el PDF (mime inválido). Probá con otro archivo."
- **Citations / sources** are mandatory whenever the LLM references a document. Format: `Reglamento académico, art. 14` or `Contrato A — cláusula 3.2`.

---

## Visual foundations

### Colors

Three brand colors carry the whole system. Everything else is neutral or
semantic.

- **Navy** (`--nai-navy-800` `#142b4b`) — primary brand surface, dark mode foundation, headers, "official documents" feel. Comes from the original hero bg in the scaffolded `global.css`.
- **Mint** (`--nai-mint-500` `#43c194`) — the "AI energy" accent. Used for: streaming-token cursors, success states, the active demo dot, and anywhere the system is doing something live. Sparingly — it's loud on purpose.
- **Paper** (`--nai-paper` `#fbfbfa`) — warm off-white app background. Not pure white, not gray — picks up the academic-document association.

Supporting colors:

- **Amber** for warnings and the "thinking" state of the agent
- **Crimson** for destructive actions and hard errors
- **Cool neutral ramp** (`--nai-ink-*`) tinted slightly toward navy

All tokens are defined as both **base** (`--nai-navy-800`) and **semantic** (`--color-bg`, `--color-fg-muted`, `--color-accent`). Always reach for semantic tokens in components. The semantic layer auto-flips for dark mode; the base layer does not.

### Type

- **IBM Plex Sans** — body, UI, headings. Substituted from Google Fonts. _(Flag: the source repo has no font files. If a real type license is acquired later, swap here.)_
- **IBM Plex Mono** — code blocks, SQL, citations, IDs, technical data, KICKER labels
- **IBM Plex Serif** — used _only_ for document-quotation contexts (a `.citation` block when the LLM pulls a fragment from an indexed PDF). It evokes "this is verbatim from a real document".

Type scale is a 1.2 modular ratio anchored on a 16 px body. Display sizes
(`--text-4xl` and up) use `letter-spacing: -0.03em` for tight, headline-grade
optical sizing. Body uses `letter-spacing: 0` and `text-wrap: pretty`.

### Layout & spacing

- 4 px spacing scale (`--space-1`…`--space-24`).
- Sidebar width is fixed at **264 px**, header height is **56 px** — these are tokens (`--sidebar-w`, `--header-h`).
- Page containers cap at 1200 px for working surfaces and 1440 px for analytics-like views.
- Generous padding inside cards (`--space-6` minimum). Density is medium-low — this is an executive-facing tool, not a power-user dashboard.

### Backgrounds & surfaces

- **No gradients as decoration.** Gradients exist in exactly two places: (1) the subtle radial in the dark-mode hero of the landing/empty state, and (2) the protection-gradient at the top of long scroll-streaming areas so token text fades into the header.
- **No background patterns or textures.** The app is functional UI; the visual interest comes from data + typography + the mint accent doing work.
- **Surfaces are flat, with a 1 px border in `--color-border` for separation**, _not_ drop shadow. Shadow is reserved for floating things (menus, modals, toasts).

### Animation

- All motion uses `--ease-out` (`cubic-bezier(0.2, 0.7, 0.2, 1)`) or `--ease-in-out`. No bounce easings except in rare delight moments (`--ease-spring`, never on layout shifts).
- Durations: `80 ms` (instant feedback), `150 ms` (default fast), `220 ms` (default base), `400 ms` (rare slow transitions, panel reveals).
- **Streaming text** is the signature animation: tokens appear character-by-character with a 1-frame mint cursor at the end. Cursor blinks at 1.1 s period when streaming pauses.
- **Card materialization** (agent SQL/result/response cards) uses a 220 ms ease-out from `opacity: 0; transform: translateY(6px) scale(0.99)` to identity.
- **No spinners** — replaced with skeleton shimmer at 1.6 s loop, OR descriptive text ("Indexando…").

### Hover, press, focus

- **Hover:** background shifts to `--color-surface-hover` for buttons/cards. No scale, no shadow, no glow. Borders on interactive elements may also intensify by one step (`--color-border` → `--color-border-strong`).
- **Press:** background shifts to `--color-surface-active`, plus a 1 px `transform: translateY(0.5px)` on raised buttons.
- **Focus:** always a 3 px outer ring in `--shadow-focus` (navy in light mode, mint in dark mode). Outline is never removed.
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`, no hover effect.

### Borders, radii, elevation

- **Border weight is 1 px universally.** Exception: input fields under focus thicken to 2 px on the bottom side only — a subtle "you're typing here" affordance.
- **Radii** step is `2 → 4 → 6 → 10 → 16 → 20 → 999`. Cards mostly use `--radius-lg` (10 px). Buttons use `--radius-md` (6 px). Pills use `--radius-pill`. Display blocks (hero, empty-state illustrations) use `--radius-2xl`.
- **Shadows are subtle and ambient.** `--shadow-sm` for elevated cards in light, `--shadow-md` for popovers/menus, `--shadow-lg` for modals. Dark mode shadows are darker but not glowing.
- **Inset shadows** are used on segmented controls and toggle tracks for an embossed, tactile feel.

### Transparency & blur

- Frosted/blurred backgrounds in two places only: the sticky `<header>` (16 px blur over a 65 % surface alpha) and modal scrims (4 px blur over a 50 % `--color-bg-inverse` alpha).
- Everything else is opaque. Glassmorphism is a no.

### Imagery

- No stock photography. No illustration of people. No hand-drawn marketing illustrations.
- **Acceptable visuals:** abstract diagrammatic SVG (vector dots, schema diagrams, infrastructure topology), simple isometric server / rack illustrations when teasing the "running on your hardware" angle, document-thumbnail placeholders (a stylized page).
- **Color treatment** when imagery does appear: desaturated, cool, with mint as the only saturated accent — like a thermal-imaging view of an enterprise datacenter, not a Behance illustration.

### Component principles

- **Cards** have a 1 px border, 10 px radius, no shadow at rest. They get `--shadow-sm` only when they're floating above other content (popover, dropdown).
- **Buttons** come in primary (navy filled), secondary (1 px border, transparent), ghost (transparent, hover only), and danger (crimson border, crimson text). All four respect the same height token (32 / 40 / 48).
- **Inputs** have a 1 px border, 6 px radius, `--color-bg-elevated` background. Focus moves border to `--color-border-focus` and adds the focus ring.
- **Badges / pills** are flat-fill, no border, low-saturation backgrounds (`--color-accent-soft`, `--color-info-bg`, etc.) with same-hue text.

---

## Iconography

The source repo has **no icon system**. The Nx-scaffold favicon is the only icon
asset that exists, and it's discarded.

**Decision:** use **Lucide** icons (<https://lucide.dev>) — open-source, MIT,
huge coverage, consistent 1.5–2 px stroke, available via CDN. Lucide's
geometric-but-humanist quality matches IBM Plex perfectly.

- **Stroke weight:** 1.5 px at default 24 px size. 1.75 px when scaled to 18 px or below to preserve weight.
- **Style:** outline only (no filled variants), rounded line caps, rounded line joins.
- **Color:** inherits `currentColor` so it follows text color in every context.
- **Sizing:** 14 px (inline with text), 16 px (dense UI), 20 px (default UI), 24 px (toolbar, sidebar), 32 px+ (empty-state hero only).

### Usage in HTML

```html
<!-- Inline SVG via Lucide's recommended pattern -->
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="message-square"></i>
<script>
  lucide.createIcons();
</script>
```

In React (Next.js), `lucide-react` is the recommended dependency. It's already
implied by the project's package.json philosophy of using small, well-maintained
deps.

### Demo icons (semantic mapping)

| Demo                 | Lucide name           | Why                     |
| -------------------- | --------------------- | ----------------------- |
| RAG (chat with docs) | `message-square-text` | Document + speech       |
| Comparator           | `git-compare-arrows`  | Side-by-side analysis   |
| Corpus               | `library-big`         | Many documents at scale |
| Agent                | `bot`                 | Tool-using agent        |

### System icons (frequent)

`upload`, `paperclip`, `database`, `play`, `square` (stop), `loader-2` (spinner — rarely used), `circle-check`, `circle-x`, `circle-alert`, `arrow-up`, `chevron-right`, `more-horizontal`, `x`, `search`, `sun`, `moon`.

### Emoji & unicode

**Not used.** No emoji in product UI. Unicode chars like `→` `·` `—` `✓` `↗` are
acceptable in text content (status lines, labels) when they read as typography,
not as icons.

### Brand mark

`assets/logo-mark.svg` and `assets/logo-mark-on-dark.svg` are a custom mark
designed for this system. Three semi-transparent mint nodes converging on a
white inference square — represents RAG (chunks → model). This mark is
intentionally simple and may evolve once a real brand identity is commissioned.
**Flagged** — see Caveats at the end.

---

## Index

The root of this design system contains:

| File / folder         | What it is                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `README.md`           | This document                                                                                                           |
| `colors_and_type.css` | All design tokens — drop into any HTML to get the brand foundation                                                      |
| `SKILL.md`            | Cross-compatible Agent Skill manifest                                                                                   |
| `assets/`             | Brand marks (logo + favicon), shared visual assets                                                                      |
| `fonts/`              | (intentionally empty) — IBM Plex loads from Google Fonts CDN. Drop real font files here if licensing changes.           |
| `preview/`            | Per-token preview cards for the Design System tab. Each card is one swatch / specimen / token, ~700 × 150 px.           |
| `ui_kits/web/`        | The web UI kit — React JSX components and an interactive `index.html` showing the full app shell and all 4 demo screens |

### UI kits

- **`ui_kits/web/`** — the only product surface. Covers app shell, sidebar, header, four demo screens (RAG chat, document comparator, corpus teaser, SQL agent), all in light + dark.

There are no slides, no mobile app, no marketing site in scope. This is a
single-product, single-surface system. When NAI hardware arrives and Python /
FastAPI enters the stack, a second UI kit may be added for any new admin
surfaces.

---

## Caveats

Read the **Caveats** block at the bottom of the UI kit's `index.html` for live
inventory of substitutions and open questions. The short version is at the end
of this README.
