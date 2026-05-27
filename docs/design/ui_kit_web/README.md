# Web UI Kit — AI Demo Platform

The product surface for the AI Demo Platform is a single Next.js web app
running on the same network as the customer's NAI hardware. This kit recreates
the full shell + every demo screen as static React components, so designers
and developers can:

- See the shell + 4 demos side-by-side, in light and dark, in one page
- Lift component code into the real Next.js project under `apps/web/src/app/`
- Pin the canonical look, copy, density, and motion before backend hookup

## Open

```
ui_kits/web/index.html
```

The whole kit is **interactive** — pick demos in the sidebar, ask the
agent a suggested question, watch the SQL stream in, toggle dark mode.

## Files

| File                 | Responsibility                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | Entry point. Loads React + Lucide, mounts `<App>`, owns demo + theme + lang state, wraps everything in `<LangContext.Provider>`.                                            |
| `ui-kit.css`         | All component classes (`.btn`, `.card`, `.bubble`, `.agent-event`, etc.). Layered on `colors_and_type.css`.                                                                 |
| `i18n.jsx`           | All user-facing strings (ES + EN), `useLang` hook (localStorage), `makeT(lang)` factory, `LangContext`, lang-aware suggested-questions and dimensions arrays.               |
| `ui.jsx`             | Shared primitives: `Button`, `Badge`, `Pill`, `Card`, `Icon` (Lucide wrapper), `Modal`, `EmptyState`, `SchemaTable`, `SqlBlock`, `useStreamingText`. Exported to `window`.  |
| `data.jsx`           | Catalog + fake-data factories (lang-aware): `buildDemos(t)`, `buildSampleDocsRag(t)`, `buildSampleDocsCompare(t)`, `buildAgentHistory(lang)`, plus the static SQL `SCHEMA`. |
| `Shell.jsx`          | App shell — sidebar with demo list + health pill, sticky frosted header with ES / EN switch and theme toggle.                                                               |
| `DemoRag.jsx`        | **Demo 01 / RAG.** Two-column: document list (upload, select, delete) + chat with streaming responses and inline citations.                                                 |
| `DemoComparator.jsx` | **Demo 02 / Comparator.** Three-step form (docs → dimensions → output) + streamed markdown analysis.                                                                        |
| `DemoCorpus.jsx`     | **Demo 03 / Corpus.** Coming-soon teaser hero + capability cards + roadmap timeline. Not a placeholder — part of the value proposition.                                     |
| `DemoAgent.jsx`      | **Demo 04 / Agent.** Three-column console (questions / event stream / schema) + materializing event cards (SQL → result → answer) + history tab.                            |

## Mapping to the real Next.js project

| This kit file        | Maps to in `apps/web/src/app/`                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DemoRag.jsx`        | `demo/rag/page.tsx` (replaces the current debug scratchpad)                                                                                        |
| `DemoComparator.jsx` | `demo/comparator/page.tsx`                                                                                                                         |
| `DemoCorpus.jsx`     | `demo/corpus/page.tsx`                                                                                                                             |
| `DemoAgent.jsx`      | `demo/agent/page.tsx`                                                                                                                              |
| `Shell.jsx`          | `layout.tsx` + a `Sidebar` / `Header` component pair                                                                                               |
| `ui.jsx` primitives  | A `components/ui/` folder; consider `Button`, `Badge`, `Pill`, `Card`, `Icon`, `Modal`, `EmptyState`, `SchemaTable`, `SqlBlock` as the starter set |

The API contracts (endpoints + types) live in `apps/web/src/lib/api/` in the
source repo and are the source of truth — this kit fakes streaming locally,
but the components are structured to be drop-in replaced by `useChatStream`,
`subscribeToAgent`, `subscribeToCompare`, `listDocuments`, etc.

## Components covered

- ES / EN language switch (segmented control, persisted to localStorage)
- Buttons — `primary`, `accent`, `secondary`, `ghost`, `danger` × `sm`/`md`/`lg`
- Inputs — text, textarea, search, chat composer with auto-grow
- Badges — `success`, `warn`, `danger`, `info`, `neutral` × icon optional
- Pills — clickable tags (selected / not), with icons
- Cards — flat, hover, with header
- Bubbles — user, assistant (with streaming cursor), thinking
- Doc cards — selectable, with delete, with PDF glyph
- Sidebar items — active, default, coming-soon
- Header — frosted, with health dot
- Modal — scrim + dialog + close
- SQL block — token-highlighted (kw/fn/str/num)
- Result table — mono, dense, scrolling
- Schema table — column types, header
- History row — grid, status icon
- Empty state — icon + title + body + CTA
- Roadmap timeline — done / current / upcoming
- Streaming primitives — `useStreamingText`, `<ThinkingDots>`, `.stream-cursor`, `.skeleton`, `.materialize`

## Not covered (intentional)

- Auth / login (out of scope per the brief)
- Settings / admin pages (out of scope)
- Mobile-first responsive (the demo runs on a projector — desktop-first)
- Real backend wiring (uses fake data + setInterval-based streaming)

## How streaming is faked here

`useStreamingText(fullText)` slices a string into the DOM with `setInterval` to
mimic the SSE token cadence. The real components on the backend side will
swap this for the live `useChatStream` hook / `subscribeToAgent` function from
`@/lib/api`. The visual primitive (the `.stream-cursor`, the materialize
animation, the card structure) stays identical.
