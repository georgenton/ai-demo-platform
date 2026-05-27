# Prompt para Claude Code — Implementar el diseño del AI Demo Platform

> **Cómo usar este archivo:**
>
> 1. Asegurate de tener el repo `georgenton/ai-demo-platform` clonado y la carpeta `design_handoff_ai_demo_platform/` en la raíz del repo (o en `docs/`).
> 2. Abrí Claude Code en la raíz del repo.
> 3. Copiá TODO el bloque de abajo (desde "Hola Claude" hasta el final) y pegalo como primer mensaje.

---

```
Hola Claude. Necesito tu ayuda para implementar un sistema de diseño completo
en este repo (georgenton/ai-demo-platform). El diseño ya está hecho y
documentado — está en la carpeta `design_handoff_ai_demo_platform/` de este
mismo repo.

## Contexto del producto

Esto es el AI Demo Platform: una app web que corre 4 demos de IA empresarial
sobre Nutanix Enterprise AI (NAI) on-premise. La presentamos en vivo a
ejecutivos no-técnicos en Ecuador (rectores, CIOs, deans, directores legales).
La presentadora es la sales rep de Nutanix + el arquitecto técnico. Las demos
son: RAG, Comparator, Corpus (teaser coming-soon), y Agent con SQL.

Tono: técnico-confiado, enterprise-serio. Más cerca de Vercel/Linear/Anthropic
Console que de un hackathon. Bilingüe ES/EN con ES como source of truth.

## Tu tarea

Implementar el diseño completo del handoff en este repo Next.js, pixel-perfect,
respetando los contratos de API existentes en `apps/web/src/lib/api/`.

## Pasos que quiero que sigas (en orden)

### Paso 1 — Orientación (no escribir código todavía)

1. Leé `design_handoff_ai_demo_platform/README.md` entero.
2. Leé `design_handoff_ai_demo_platform/DESIGN_SYSTEM.md` entero.
3. Listá el contenido de `design_handoff_ai_demo_platform/ui_kit_web/` y leé:
   - `index.html`
   - `ui-kit.css`
   - `ui.jsx` (primitives)
   - `Shell.jsx`
   - Las 4 demos: `DemoRag.jsx`, `DemoComparator.jsx`, `DemoCorpus.jsx`, `DemoAgent.jsx`
   - `i18n.jsx` (strings ES + EN — ESTO es la fuente de verdad de copy)
   - `data.jsx`
4. Leé el `CLAUDE.md` del repo y el `apps/web/package.json` para confirmar
   stack actual.
5. Listá `apps/web/src/lib/api/` y leé los archivos — esos son los contratos
   de endpoints / tipos / hooks de streaming que el frontend va a consumir.
   NO inventar contratos: usar lo que ya existe.
6. Listá `apps/web/src/app/` para ver qué ya está scaffolded.

### Paso 2 — Plan

Después de leer todo, escribí un plan de implementación en un mensaje (sin
código todavía). El plan debe cubrir:

- Qué dependencies hay que instalar (mínimo: `lucide-react`).
- Cómo vas a portar `colors_and_type.css` (probablemente como global CSS en
  `apps/web/src/app/globals.css` o importado desde `layout.tsx`).
- Cómo vas a estructurar `components/ui/` (Button, Badge, Pill, Card, Icon,
  Modal, EmptyState, SchemaTable, SqlBlock) — TypeScript port de `ui.jsx`.
- Cómo vas a estructurar `components/` para Shell (Sidebar + Header).
- Cómo vas a portar `i18n.jsx` → `lib/i18n.ts` con tipos para las keys.
- Orden de implementación de las 4 demos (sugerencia: RAG primero porque ya
  hay un scratchpad ahí, después Agent, después Comparator, Corpus último).
- Cómo vas a conectar a los hooks reales de `lib/api/` (useChatStream,
  subscribeToAgent, etc.) reemplazando el `useStreamingText` fake del kit.
- Strategy para dark mode (data-theme attr en <html>, igual que el kit).
- Strategy para el switch ES/EN (Context provider, persistencia en
  localStorage con key `adp-lang`).

Esperá mi go-ahead antes de empezar a escribir código.

### Paso 3 — Implementación

Cuando dé el OK, implementá en este orden:

1. **Tokens y globals** — copiá `colors_and_type.css` a la ubicación que
   propusiste y wireá el `@import` desde `layout.tsx`. Verificá que las
   fuentes IBM Plex cargan.
2. **i18n** — port `i18n.jsx` → `lib/i18n.ts` + `LangContext` provider.
3. **Primitives** — `components/ui/*.tsx` para cada export de `ui.jsx`.
   Mantené los class names (`btn`, `badge`, `card`, etc.) y la estructura
   del DOM idéntica al kit — `ui-kit.css` está pensado para drop-in. Copiá
   `ui-kit.css` también, junto a tokens.
4. **Shell** — `layout.tsx` con sidebar + header sticky frosted + switch
   ES/EN + toggle dark.
5. **Demo RAG** — reemplazar el debug scratchpad en `apps/web/src/app/demo/rag/page.tsx`.
   Wirear con `listDocuments`, `uploadDocument`, `deleteDocument`,
   `useChatStream` del `lib/api`.
6. **Demo Agent** — `apps/web/src/app/demo/agent/page.tsx`. Wirear con
   `subscribeToAgent`.
7. **Demo Comparator** — `apps/web/src/app/demo/comparator/page.tsx`.
   Wirear con `subscribeToCompare`.
8. **Demo Corpus** — `apps/web/src/app/demo/corpus/page.tsx`. Es estática
   (teaser), no requiere API.

Después de cada paso, mostrame el diff y esperá que confirme antes del
siguiente.

## Reglas duras (no negociables)

1. **Pixel-perfect contra el kit.** Si algo no matchea, abrí el JSX del kit y
   leé exactamente cómo está hecho.
2. **Sentence case en TODO el copy.** Nunca Title Case, nunca ALL CAPS
   (excepto `.eyebrow` / KICKER).
3. **No emoji en product UI.** Estado vía Lucide icons + color.
4. **No gradientes decorativos.** Solo las 2 excepciones documentadas en
   `DESIGN_SYSTEM.md`.
5. **No spinners.** Streaming token-by-token con cursor mint, o skeleton
   shimmer, o texto descriptivo ("Indexando…", "Generando SQL…").
6. **Iconos = lucide-react SIEMPRE.** Nunca hand-rolled SVG.
7. **Cards en reposo NO tienen shadow.** Solo border 1 px. Shadow solo en
   floating (menus, modals, toasts).
8. **Navy + mint son load-bearing.** Nunca sustituir.
9. **Toda string en `lib/i18n.ts` bajo `STRINGS.es` y `STRINGS.en` en el
   mismo commit.** Nunca hardcodear copy en componentes.
10. **NO inventar contratos de API.** Si necesitás un endpoint que no existe
    en `apps/web/src/lib/api/`, paralo y preguntame.

## Cómo correr el design kit como referencia visual

Mientras desarrollás, abrí
`design_handoff_ai_demo_platform/ui_kit_web/index.html` en el browser para
ver el target. Tiene las 4 demos navegables, switch ES/EN, toggle dark, y
streaming fake para ver la animación canónica.

## Si algo no está claro

Pará y preguntame. Es preferible una pregunta a una suposición.

Empezá por el Paso 1 (orientación) ahora.
```

---

## Notas para vos (el usuario), no para Claude Code

- Si el repo `ai-demo-platform` cambió mucho desde que armamos este design
  system, puede ser que `apps/web/src/lib/api/` ya tenga más hooks o que la
  estructura de carpetas no matchee. Eso está bien — Claude Code va a leerlo
  primero y adaptarse.
- Si querés que Claude Code haga TODO de corrido sin pararse a confirmar entre
  pasos, quitá las dos líneas que dicen "esperá mi go-ahead" / "mostrame el
  diff y esperá confirmación". Yo recomiendo dejarlas la primera vez.
- Si querés acelerar y saltearte la fase de plan, podés decirle "Saltate el
  Paso 2 y arrancá directo con el Paso 3" después de que termine el Paso 1.
- El paquete asume que el repo `georgenton/ai-demo-platform` ya existe en tu
  filesystem. Si lo vas a clonar de cero, hacelo antes y copiá esta carpeta
  adentro.
