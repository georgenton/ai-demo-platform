---
name: ai-demo-platform-design
description: Use this skill to generate well-branded interfaces and assets for the AI Demo Platform — a series of enterprise-AI demos that run on Nutanix Enterprise AI (NAI) on-premise hardware, shown live to non-technical executives (rectors, CIOs, deans) in Ecuadorian universities and companies. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping or production work in this brand.
user-invocable: true
---

# AI Demo Platform — Design Skill

Read `README.md` first for the full context: the product, the audience, the
visual foundations, the content fundamentals, and the iconography. Read
`colors_and_type.css` for every token used in this system.

## Files in this skill

- `README.md` — brand & system documentation (start here)
- `colors_and_type.css` — design tokens (colors, type, spacing, motion, shadows) + element defaults + dark mode
- `assets/` — logo mark and wordmark (light + dark variants)
- `preview/` — per-token preview cards (one card per swatch / specimen)
- `ui_kits/web/` — full UI kit: React components for the app shell + all 4 demo screens

## When to use

### Visual artifacts (slides, mockups, throwaway prototypes)

1. Copy `colors_and_type.css` into the artifact folder and link it from your HTML.
2. Use IBM Plex Sans / Mono / Serif via the Google Fonts `@import` already in the CSS.
3. Use Lucide icons from CDN — never hand-roll SVG icons.
4. Lift component classes (`.btn`, `.badge`, `.card`, `.bubble`, `.agent-event`, `.sql-block`, etc.) from `ui_kits/web/ui-kit.css` as needed.
5. Use logos from `assets/` directly — don't recreate them.
6. Spanish copy (Ecuadorian-neutral), sentence case, no emoji, technical but warm.

### Production code

1. Read `ui_kits/web/README.md` for the file → real-app mapping.
2. Component primitives in `ui_kits/web/ui.jsx` are the canonical visual shapes — port them to TypeScript / your component library, but keep the same DOM structure and class names so `colors_and_type.css` continues to work.
3. The API contracts (endpoints + types) live in the source repo `apps/web/src/lib/api/` — they are the source of truth, not this skill.
4. Streaming UX (token-by-token chat, materializing event cards, mint cursor) is the signature interaction. Don't replace it with spinners.

## When invoked without other guidance

Ask the user:

1. What product surface are you working on? (one of the 4 demos, or the shell, or something new)
2. Are you sketching exploratory variations, or trying to nail down a single canonical design?
3. Is this for the live presentation (desktop + projector) or a different surface?
4. Light, dark, or both?

Then act as an expert designer for this brand: produce HTML artifacts (mocks /
prototypes / decks) or production-ready JSX, depending on the need. Always
pull from `README.md` and `colors_and_type.css` — never reinvent the system.

## Hard constraints

- **Spanish and English copy in lockstep.** Every string lives in `ui_kits/web/i18n.jsx` under both `STRINGS.es` and `STRINGS.en`. The header has an ES / EN switch; never hard-code Spanish or English strings in components. Spanish is the source-of-truth voice; English mirrors it.
- **No emoji** in product UI. Use Lucide icons for status + meaning, color for tone.
- **Sentence case** everywhere. Never Title Case, never ALL CAPS (except in `.eyebrow` KICKER labels).
- **Streaming-first.** Whenever the LLM is producing output, show it appearing token-by-token with a mint cursor. Never use a generic spinner.
- **No gradient backgrounds** as decoration. Two exceptions documented in README → Visual foundations.
- **Citations** are mandatory when the LLM references a document. Use the `.citation-inline` style.
- **Never substitute the brand colors** for a generic blue or purple — the navy + mint pair is load-bearing.

## Caveats and substitutions to flag

Before relying on any of these, confirm with the user — these were chosen
without final brand sign-off:

- Logo mark (`assets/logo-mark.svg`) is a designer-proposed placeholder.
- IBM Plex is loaded from Google Fonts; no font files exist in the source repo.
- Lucide is the chosen icon system; the source repo had no icon system.

If a real brand identity or font license arrives, swap and update `README.md`.
