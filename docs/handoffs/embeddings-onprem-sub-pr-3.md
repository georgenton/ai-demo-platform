# Handoff Codex — Sub-PR 3 (Embeddings on-prem · Frontend UX)

> **Cómo usar este documento.** Léelo de arriba a abajo y verifica las
> secciones reproducibles. Devuelve hallazgos en el formato pedido al
> final.

## Qué cambia este sub-PR

Tercer sub-PR de 4 del tren "Embeddings on-prem" (ADR-0018). **Solo
frontend** — la UX que cubre el bloqueo del demo RAG cuando el dropdown
del header está en `anthropic`.

### Stacked sobre sub-PR 2

Esta rama se basa en `feat/embeddings-on-prem-pr-2-backend` (PR #94). Si
se mergea sub-PR 2 antes, GitHub recalcula la base automáticamente.

### Archivos tocados (solo sub-PR 3)

| Archivo                                                 | Cambio                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/shared/LlmProviderWarning.tsx` | Nuevo. Banner naranja con icono, texto explicativo, y botón "Cambiar a NAI on-prem" que llama `setProvider('private-mac')`.            |
| `apps/web/src/components/shell/LlmProviderSwitch.tsx`   | Agrega badge "sin RAG" + tooltip a la opción Anthropic del dropdown.                                                                   |
| `apps/web/src/app/(shell)/demo/rag/page.tsx`            | Si provider=anthropic, monta `<LlmProviderWarning />`, deshabilita el botón "Subir documento", el `<textarea>` del composer y el send. |
| `apps/web/src/app/(shell)/demo/corpus/page.tsx`         | Misma lógica para corpus: banner + bloqueo de upload.                                                                                  |
| `apps/web/src/lib/i18n/strings.ts`                      | Claves nuevas ES + EN: `llm.provider.anthropicNoRag(Hint)`, `rag.providerWarning.{title,body,cta}`, `rag.upload.disabled`.             |
| `apps/web/src/app/styles/ui-kit.css`                    | `.llm-switch-badge` (badge naranja) + `.llm-provider-warning*` (banner con icono, texto, CTA, responsive en mobile).                   |
| `docs/handoffs/embeddings-onprem-sub-pr-3.md`           | Este documento.                                                                                                                        |

### Lo que NO toca este sub-PR

- Backend (en sub-PRs 1 y 2).
- ADR-0018 (en sub-PR 1, cerrado en sub-PR 4).
- Runbook (en sub-PR 4).
- Search/Summary del corpus — sigue funcionando con el provider activo
  pero si el backend falla con 400, el handler de error lo expone. Una
  futura iteración puede deshabilitar también esos inputs.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + build

```bash
cd ~/Projects_local/ai-demo-platform
npm test                                    # esperado: 421/421 verde
npm run lint                                # esperado: sin output
npx tsc -p apps/web/tsconfig.json --noEmit  # esperado: sin output
( cd apps/web && npx next build )           # esperado: build OK, 10 rutas estáticas + 1 dinámica
```

### Sección 2 — Inspección visual local

Levantar el web (no necesita backend para esta verificación):

```bash
( cd apps/web && npx next dev )
```

Visitar `http://localhost:4200` (asume login bypass o seed). En el header
abrir el dropdown del LLM:

| #   | Acción                                   | Esperado                                                                                      |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Abrir dropdown del header                | Dos opciones; "Anthropic API" muestra badge **"sin RAG"** a la derecha del label              |
| 2   | Hover sobre opción Anthropic             | Tooltip "Anthropic does not provide embeddings — demos that search inside documents require…" |
| 3   | Seleccionar "Anthropic API"              | Dropdown se cierra, label del header pasa a "Anthropic API"                                   |
| 4   | Visitar `/demo/rag`                      | Banner naranja arriba del two-col: título + body + botón "Cambiar a NAI on-prem"              |
| 5   | Botón "Subir documento" del header       | Deshabilitado, tooltip "Cambia el modelo a NAI on-prem para subir documentos"                 |
| 6   | Composer del chat                        | `<textarea>` y botón send deshabilitados                                                      |
| 7   | Click "Cambiar a NAI on-prem" del banner | Provider cambia a `private-mac`, banner desaparece, controles vuelven a habilitarse           |
| 8   | Cambiar idioma a EN                      | Banner se traduce: "This demo needs NAI on-prem" / "Switch to NAI on-prem"                    |
| 9   | Visitar `/demo/corpus` con anthropic     | Banner naranja + botón "Subir documentos" deshabilitado                                       |

### Sección 3 — Comportamiento esperado con backend (sub-PR 2 activo)

Si tienes el backend de sub-PR 2 corriendo + dropdown en `anthropic`:

- Cualquier intento de `POST /ingest`, `POST /corpus/upload` o `GET /chat`
  debería ser bloqueado por la UI ANTES de hacer el request → no se llega
  al 400 del backend.
- Si por alguna razón el request escapa (race condition, click rápido),
  el backend lo va a rechazar con 400 y el handler de error del frontend
  lo va a mostrar.

### Sección 4 — Defensa en profundidad

Verificar manualmente que el `send()` del chat de `/demo/rag` también
chequea `ragBlocked` (no solo el botón). Esto evita un bug raro: si el
state se desincroniza entre render y handler, la guardia interna corta.

```ts
function send() {
  const q = input.trim();
  if (!q || chatStatus === 'streaming' || ragBlocked) return;
  // ...
}
```

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación + build

- `npm test` salida (resumen).
- `npm run lint` salida.
- `tsc apps/web` salida.
- `next build` salida (resumen de rutas).

### Sección B — Inspección del LlmProviderSwitch

- Opción `anthropic` tiene `badgeKey: 'llm.provider.anthropicNoRag'`.
- La opción `private-mac` NO tiene badge.
- El render del menuitem muestra el badge cuando `opt.badgeKey` está.

### Sección C — Inspección de LlmProviderWarning

- Existe en `apps/web/src/components/shared/`.
- Recibe sin props (usa `useLlmProvider` internamente).
- El botón CTA llama `setProvider('private-mac')`.
- i18n keys `rag.providerWarning.title/body/cta` existen en ES + EN.

### Sección D — Inspección de las páginas afectadas

- `/demo/rag/page.tsx`:
  - Importa `useLlmProvider` y `LlmProviderWarning`.
  - `ragBlocked = provider === 'anthropic'`.
  - Monta `<LlmProviderWarning />` cuando `ragBlocked`.
  - Botón "Subir documento" + textarea + send button reciben `disabled` con `ragBlocked` en el OR.
  - `send()` chequea `ragBlocked` para defensive coding.
- `/demo/corpus/page.tsx`:
  - Misma lógica para banner + botón upload.

### Sección E — CSS

- `.llm-switch-badge` existe en `apps/web/src/app/styles/ui-kit.css` con
  estilo pill discreto.
- `.llm-provider-warning` existe con `background` warning + icono naranja.
- Modo oscuro tiene reglas `[data-theme='dark']` para ambos.

### Sección F — Riesgos detectados (si hay alguno)

Cualquier cosa que el reporte automatizado no cuente pero que se note
manualmente al leer el código (accesibilidad, race conditions, edge
cases).

---

**Nota para Jorge:** este sub-PR puede mergearse después del #93 y #94, o
en cualquier orden si se acepta que el frontend sin backend muestra el
banner pero los requests siguen llegando con `X-LLM-Provider: anthropic`
y reciben 400 del backend viejo (mensaje confuso). Por eso preferimos
mergear el tren completo en orden.
