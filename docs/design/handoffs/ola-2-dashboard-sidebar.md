# Handoff a Claude Design — Ola 2 (dashboard + sidebar con branding)

> **Propósito de este documento.** Segundo handoff visual del sprint
> multi-tenant. Define qué piezas rediseñar, qué contratos no romper,
> qué tokens del ui-kit usar y qué libertades quedan abiertas. Pegalo
> entero a Claude Design como input — es self-contained.
>
> **Estado:** Pendiente de implementación por Claude Design.
> **Sprint relacionado:** PRs #60–#66 (multi-tenant MT1..MT7-prep).
> **Ola anterior:** Ola 1 — `/login` + header
> ([handoff](./ola-1-login-header.md), PR #67).
> **Próxima ola:** Ola 3 — `/admin/tenant` (admin panel).

---

## 1. Contexto

Con la Ola 1 cerrada, el flujo de entrada al producto ya tiene polish:
el cliente abre `/login`, entra, y aterriza en alguna parte. Esta ola
es **lo que ve después de loguearse** — la cartelera del SaaS y la
navegación que lo acompaña en cada pantalla.

Las dos piezas:

1. **`/` (dashboard)** — grilla de cards con los demos habilitados del
   tenant. Es la pantalla "wow": acá se decide si la plataforma vale lo
   que cuesta o no.
2. **Sidebar con branding del tenant** — está presente en cada
   pantalla del shell. Hoy ya filtra demos por tenant y aplica branding,
   pero la implementación es directa (logo, color, nombre) y no maneja
   bien los casos borde (nombres largos, colores poco accesibles, sin
   logo).

---

## 2. Decisiones de producto ya tomadas

Las mismas que la Ola 1, sin novedades:

| Decisión                       | Implementación                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Branding default del producto  | Verde NAI `--nai-mint-500` (ya está en `tokens.css` como `--color-accent`).                           |
| Idioma de la app               | Español por default; switch EN/ES en el header.                                                       |
| Tema                           | Sigue al sistema operativo (`prefers-color-scheme`).                                                  |
| Branding por tenant en sidebar | Override de `accentColor`, `logoUrl`, `displayName`. El resto de la app NO se brandea (consistencia). |

**Decisión nueva para esta ola:** los demos del catálogo no tienen
imágenes/ilustraciones propias hoy. Para esta ola, definir un sistema
de **identidad visual por demo** (color accent + ícono + ilustración
SVG simple, monocromática, que escala dark/light). Cinco demos, cinco
"caras". Los ID son: `rag`, `comparator`, `corpus`, `agent`, `tutor`.

---

## 3. Pieza A — Dashboard `/`

### Archivo a tocar

`apps/web/src/app/page.tsx`

### Estado actual (stub funcional)

- Grilla CSS `auto-fill` de mínimo 280px por card.
- Welcome con nombre del user + subtitle con tenant + industry.
- Cards con título, tagline (italic), descripción, link "Abrir →".
- Estados `loading`, `error`, `empty` como placeholders centrados con
  texto plano.

Usa los mismos tokens **incorrectos** que el resto de stubs MT4/MT5
(ver sección 6).

### Contratos — NO TOCAR

```tsx
'use client';

import { useAuth, useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { MeDemo } from '@/lib/api/types-auth';

// Hooks que ya están disponibles:
const { t } = useT();
const auth = useAuth();
// auth.status: 'loading' | 'authenticated' | 'unauthenticated' | 'error'
// auth.user: { id, email, displayName, role } | null
// auth.tenant: { id, slug, displayName, industry: {...}, branding, status } | null

const { status, data, refresh } = useMyDemos();
// status: 'idle' | 'loading' | 'ready' | 'error'
// data: MeDemosResponse | null
// data.tenant: { id, slug, displayName, branding, status }
// data.industry: { slug, displayName, defaultConfig }
// data.demos: MeDemo[]  // ← este array es lo que pintás como cards
// data.overridden: boolean  // true si el tenant overrideó la lista de la industry

// Shape de cada demo:
interface MeDemo {
  id: string; // 'rag' | 'comparator' | 'corpus' | 'agent' | 'tutor'
  title: string; // "Chat con documentos"
  tagline: string; // "Chatea con el reglamento académico..."
  description: string;
  audience: string[]; // ["Universidades", "RRHH", ...]
  status: 'available' | 'coming-soon';
  route: string; // "/demo/rag"
}
```

Estados que el dashboard **debe seguir cubriendo**:

1. **`auth.status === 'loading' || useMyDemos.status in ('idle', 'loading')`**
   → mostrar estado de carga (placeholder/skeleton).
2. **`useMyDemos.status === 'error' || !data`** → mostrar mensaje de
   error genérico con CTA "Reintentar" (llamar `refresh()`).
3. **`data.demos.length === 0`** → empty state con copy "no hay demos
   habilitados" + sugerencia de contactar al admin.
4. **Caso normal** → grilla de cards.

### Strings i18n disponibles (ES + EN)

```
dashboard.welcome              → "Hola, {name}" / "Hello, {name}"
dashboard.subtitle             → "{tenantName} · {industryName}. Estas son las demos habilitadas..."
dashboard.empty.title          → "No hay demos habilitados"
dashboard.empty.body           → "Tu organización aún no tiene demos asignados..."
dashboard.openDemo             → "Abrir" / "Open"
dashboard.loading              → "Cargando tu cartelera…" / "Loading your demos…"
dashboard.error                → "Hubo un problema cargando tus demos..."
```

### Strings i18n a agregar (opcionales pero recomendados)

Si la nueva UI los necesita, los **agregás vos** en el mismo PR en
ambos idiomas (`STRINGS_ES` y `STRINGS_EN` en `strings.ts`):

```ts
// Ejemplos posibles:
'dashboard.hero.title': 'Demos de IA empresarial en NAI on-prem',
'dashboard.section.demos': 'Tus demos',
'dashboard.section.activity': 'Actividad reciente', // si agregás un widget
'dashboard.card.audience': 'Audiencia',
'dashboard.card.comingSoon': 'Próximamente',
'dashboard.error.retry': 'Reintentar',
'dashboard.tenant.role.admin': 'Sos admin de {tenant}',
'dashboard.industry.label': 'Industria',
```

### Libertades creativas

Esto es lo que **sí** puedes cambiar libremente:

- **Layout**: hero arriba con CTA principal, grilla simple, grilla con
  primer card destacado (golden ratio), masonry, lo que sea.
- **Identidad visual por demo**: definí un set de 5 "thumbnails" — un
  ícono distintivo (de [Lucide](https://lucide.dev/icons)) + un color
  accent o gradient consistente con el demo. Sugerencia:
  - `rag` → MessageSquare + azul navy
  - `comparator` → GitCompare + ámbar
  - `corpus` → Library + violeta
  - `agent` → Bot + verde mint (el accent default)
  - `tutor` → Mic + rosa coral
    Mantenelos sutiles — son micro-thumbnails, no banners.
- **Empty state ilustrado**: un SVG simple con un mensaje cálido.
- **Loading state**: skeletons con shimmer en lugar de texto plano.
- **Microanimación al hover**: subtle scale, border accent, sombra.
  Respetá `prefers-reduced-motion`.
- **Badge del rol**: si `auth.user.role === 'admin'`, mostrá un chip
  "Admin" cerca del welcome.
- **Indicador "overridden"**: si `data.overridden === true`, badge
  pequeño con "Cartelera personalizada" — útil para que el admin sepa
  que está viendo una lista custom, no la default de su industria.
- **Footer del dashboard**: opcional, con badge "Servicio en línea"
  conectado a `GET /api/v1/health` (a futuro).
- **Responsive**: la grilla `auto-fill 280px` ya es responsiva pero
  podés afinar el min/max por breakpoint para tablets.

### Referencias visuales (sugeridas)

- **Vercel Dashboard** — cards con preview-thumbnail, mucho aire,
  status chips precisos.
- **Linear** — íconos por entidad, jerarquía visual clara.
- **Stripe Dashboard** — color por producto, accent muy específico
  para CTA principal.
- **GitHub Projects** — empty state cálido y útil.

### Lo que NO puedes hacer

- Asumir que siempre hay 5 demos. Un tenant `salud` puede tener solo
  `rag` + `agent`. La grilla debe verse OK con 1, 2, 3, 4 o 5 cards.
- Cambiar las rutas de los demos (`demo.route`) — son parte del
  contrato con el backend (PR-MT3, `@RequireDemo`).
- Ignorar el caso `data.demos.length === 0` — un tenant nuevo sin
  industria asignada puede llegar a este estado.
- Hardcodear los IDs (`'rag'`, `'comparator'`, etc.) en lugar de
  iterar sobre `data.demos`. Si mañana se suma `demo-06`, el backend
  ya lo manda y la UI debería renderizarlo sin tocarse.

---

## 4. Pieza B — Sidebar con branding del tenant

### Archivo a tocar

`apps/web/src/components/shell/Sidebar.tsx`

### Estado actual

- Brand lockup arriba: logo del tenant o NAI default + `displayName`
  del tenant o "AI Demo Platform" + tagline "NUTANIX ENTERPRISE AI".
- Lista de demos filtrada por `useMyDemos().data.demos` (solo
  habilitados).
- `accentColor` del tenant inyectado como `--color-accent` inline en
  el `<aside>`.
- "Servicio activo" abajo con health dot pulsante (estático hoy).

Funciona end-to-end pero tiene casos borde sin manejar:

- Nombres de tenant largos cortan o se desbordan (ej. "Universidad
  Técnica Particular de Loja — Sede Norte").
- `accentColor` con contraste pésimo (ej. `#FFFF00` sobre blanco) puede
  romper la legibilidad.
- Cuando no hay `logoUrl`, el lockup queda con el logo NAI + nombre del
  tenant — visualmente confuso ("¿de quién es esta plataforma?").

### Contratos — NO TOCAR

```tsx
'use client';

import { useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const { t } = useT();
const { theme } = useTheme(); // 'light' | 'dark'
const { data: meDemos } = useMyDemos();
// meDemos puede ser null durante loading inicial — el sidebar muestra
// el catálogo completo como "optimistic display" mientras carga.

// Branding del tenant — leído defensive:
meDemos?.tenant.displayName; // string
meDemos?.tenant.branding; // unknown — leer con type guards:
// - branding.logoUrl?    string (URL pública)
// - branding.accentColor? string (hex #RRGGBB validado)
// - branding.displayName? string (override del nombre visible)

// La filtración de demos del catálogo ya está hecha:
const enabled = new Set(meDemos?.demos.map((d) => d.id));
const sidebarDemos = allDemos.filter((d) => enabled.has(d.id));
```

### Strings i18n disponibles

```
shell.demos                → "Demos"
shell.servicio             → "Servicio activo" / "Active service"
shell.servicio.meta        → "api.v1 · 200 ms"
shell.brand.tag            → "NUTANIX ENTERPRISE AI"
shell.coming               → "Pronto" / "Soon"
```

### Strings i18n a agregar (opcionales)

```ts
'shell.tenant.industry': 'Industria',  // tooltip o subtítulo
'shell.tenant.adminBadge': 'Admin',     // si user es admin del tenant
'shell.brand.poweredBy': 'Powered by NAI', // footer del sidebar cuando hay logo custom
```

### Lo que tienes que mejorar (problemas concretos)

1. **Brand lockup adaptativo según presencia de logo del tenant:**
   - Con `branding.logoUrl`: usar **solo el logo del tenant** arriba
     grande, y un footer al fondo con "Powered by NAI" + logo mark
     pequeño NAI.
   - Sin `branding.logoUrl`: lockup actual (logo NAI + nombre tenant),
     pero más sutil — el logo NAI no debería competir con el tenant
     name visualmente.

2. **Manejo de nombres largos:**
   - Truncar con elipsis (`text-overflow: ellipsis`) sin romper el
     layout.
   - Tooltip con el nombre completo al hacer hover.
   - Considerar dos líneas si es razonable.

3. **Validación visual de `accentColor`:**
   - Si el contraste del accent contra el fondo del sidebar es menor
     a WCAG AA, **caer al accent default del producto** (`--nai-mint-500`).
     No queremos que un admin distraído rompa la accesibilidad de su
     propio panel.
   - Para calcular contraste podés usar
     [contrast-ratio](https://www.npmjs.com/package/get-contrast) o
     escribir un util pequeño (4-5 líneas, fórmula WCAG).

4. **Servicio activo (footer del sidebar):**
   - Hoy es decorativo. Conectarlo a `GET /api/v1/health` (la respuesta
     es `{ status: "ok", db: "ok", llm: "ok" }`) — si alguno falla, el
     dot se pone naranja/rojo.
   - El polling debería ser barato (cada 30s, no cada segundo).

### Libertades creativas

- **Brand lockup**: lo de arriba ya da la regla, pero la forma exacta
  queda libre (vertical, horizontal, con tagline, sin).
- **Demo items**: el shell actual los renderiza como rows con ícono
  - título + tagline. Podrías colapsar la tagline en hover (sidebar más
    compacto). O agregar el rol del demo (badge "Beta", "Nuevo").
- **Estado del usuario en el sidebar**: opcional. Podrías mover el
  menú de usuario del header al footer del sidebar — discusión de
  layout. Si lo hacés, asegurate de coordinar con la Ola 1 (puede
  pisarse).
- **Accent color del tenant**: cómo se manifiesta. Hoy solo afecta
  items activos. Podrías usarlo en el border izquierdo del item
  activo, en el dot del logo, en la barrita del scroll, etc. Sé
  generoso pero subtle.

### Lo que NO puedes hacer

- Eliminar el filtro por `enabledDemos` — la regla multi-tenant es
  fundamental.
- Renderizar logos de tenants con `<Image>` optimizado de Next sin
  `unoptimized` — los logos custom vienen de dominios arbitrarios y
  romperían el build sin esa prop (ya está en el código actual).
- Asumir que el sidebar siempre se muestra. En la Ola 1 podríamos
  estar agregando un menú colapsable para mobile — si modificás
  estructura, dejá hooks o props para que el comportamiento responsive
  sea fácil de agregar después.

---

## 5. Sistema de tokens disponible

(Mismo que en el handoff de la Ola 1 — los repito acá por
self-containment del documento.)

### Colores

```css
/* Backgrounds */
--color-bg              /* fondo principal de la app */
--color-bg-elevated     /* cards, modales */
--color-bg-sunken       /* inputs */
--color-bg-inverse      /* tooltips oscuros */
--color-surface         /* superficie de cards/buttons */
--color-surface-hover
--color-surface-active
--color-surface-selected

/* Borders */
--color-border
--color-border-strong
--color-border-subtle
--color-border-focus

/* Foreground */
--color-fg              /* texto primario */
--color-fg-muted        /* secundario */
--color-fg-subtle       /* metadata */
--color-fg-disabled
--color-fg-inverse
--color-fg-link

/* Marca */
--color-accent          /* verde NAI mint */
--color-accent-fg
--color-accent-soft
--color-brand           /* navy del logo */
--color-brand-fg

/* Estados */
--color-success / --color-success-bg
--color-warn    / --color-warn-bg
--color-danger  / --color-danger-bg
--color-info    / --color-info-bg
```

### Espacios (escala de 4px)

`--space-0` (0), `--space-1` (4), `--space-2` (8), `--space-3` (12),
`--space-4` (16), `--space-5` (20), `--space-6` (24), `--space-8` (32),
`--space-10` (40), `--space-12` (48), `--space-16` (64), `--space-24` (96).

### Radios

`--radius-xs` (2), `--radius-sm` (4), `--radius-md` (6),
`--radius-lg` (10), `--radius-xl` (16), `--radius-2xl` (20),
`--radius-pill` (999).

### Sombras

`--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`,
`--shadow-inset`, `--shadow-focus`.

### Tipografías

`--font-sans` (Inter), `--font-mono` (JetBrains Mono),
`--font-serif` (IBM Plex Serif — útil para headlines del hero).

---

## 6. ⚠️ Bug en los stubs actuales

Los stubs de `/`, `/login` y `/admin/tenant` usan tokens **inexistentes**
con fallbacks hardcoded. Tabla de conversión para migrar:

| Stub usa                         | No existe | Token real                                              |
| -------------------------------- | --------- | ------------------------------------------------------- |
| `var(--surface-bg, #0c1418)`     | ❌        | `var(--color-bg)`                                       |
| `var(--surface-card, #131e23)`   | ❌        | `var(--color-bg-elevated)` o `var(--color-surface)`     |
| `var(--surface-input, #0c1418)`  | ❌        | `var(--color-bg-sunken)`                                |
| `var(--text-strong, #f0f5f8)`    | ❌        | `var(--color-fg)`                                       |
| `var(--text-default, #c5d1d8)`   | ❌        | `var(--color-fg)`                                       |
| `var(--text-muted, #87969f)`     | ❌        | `var(--color-fg-muted)`                                 |
| `var(--text-danger, #ff6b7a)`    | ❌        | `var(--color-danger)`                                   |
| `var(--accent-default, #43c194)` | ❌        | `var(--color-accent)`                                   |
| `var(--border-default, #1f2c33)` | ❌        | `var(--color-border)`                                   |
| `var(--spacing-N, *)`            | ❌        | `var(--space-N)`                                        |
| `var(--font-size-*, *)`          | ❌        | usar `font-size: 14px` directo o agregar el token       |
| `var(--radius-md, 8px)`          | ✅ existe | `var(--radius-md)` (es 6px, no 8px — corregí también)   |
| `var(--radius-lg, 12px)`         | ✅ existe | `var(--radius-lg)` (es 10px, no 12px — corregí también) |

**Parte del trabajo de esta ola** es migrar los inline styles de
`page.tsx` a los tokens reales del proyecto. Para los inline styles del
sidebar (que usan `--color-accent` inline correctamente), revisar que
no agregamos mezclas con tokens viejos.

Mejor todavía: **mover los estilos a `ui-kit.css` con clases
reutilizables** (siguiendo el patrón del `.sidebar`, `.header`,
`.demo-item` ya existentes).

---

## 7. Cómo verificar antes de hacer push

```bash
# Tests no deben romperse — la lógica del provider y hooks no cambia.
npm test
# Espera: 348/348 (o más, si agregás tests propios).

# Lint sin errores.
npm run lint

# Typecheck pasa.
npx tsc --noEmit -p apps/web/tsconfig.json

# Build de Next.js compila.
npx nx build web
```

### Smoke local

1. **Antes** de tocar nada: `npm run db:seed:tenants` + `db:seed:demos`
   si no los corriste todavía.
2. `npx nx serve api` en una terminal.
3. `PORT=4200 npx nx dev web` en otra.
4. Loguea con `admin@nai.local` / `demo-platform-2026`.
5. **Esperado en `/`:**
   - Dashboard con cards de los 5 demos del tenant `demo` (industria
     `universidad`).
   - Welcome con "Hola, Superadmin Demo".
   - Subtitle con "Demo · Tenant interno NAI · Educación superior".
6. **Sidebar:**
   - Logo NAI default + "Demo · Tenant interno NAI" como displayName.
   - Lista de 5 demos.
   - Accent verde (no hay override).
7. **Probar con branding overrideado:**
   - Ir a `/admin/tenant`.
   - Cambiar `accentColor` a `#FF6600` (naranja).
   - Cambiar `logoUrl` a un PNG cualquiera (ej. `https://placehold.co/64`).
   - Cambiar `displayName` del branding a "UTPL".
   - Guardar.
   - Volver a `/` → el sidebar debería reflejar los cambios sin
     reload (gracias al `refresh()` del hook).
8. **Probar caso edge:**
   - En `/admin/tenant`, desmarcar todos los demos. Guardar.
   - Volver a `/` → debería mostrar el empty state.
9. **Probar accesibilidad:**
   - Setear `accentColor` a `#FFFFAA` (amarillo bajo contraste).
   - Verificar que el sidebar cae al accent default por la guarda de
     contraste (no se rompe la legibilidad).
10. **Probar ambos themes:**
    - Light + dark — el dashboard y sidebar deben funcionar en los dos.

---

## 8. Resumen de archivos que tocás

| Archivo                                     | Acción                              | Líneas estimadas |
| ------------------------------------------- | ----------------------------------- | ---------------- |
| `apps/web/src/app/page.tsx`                 | Rewrite del layout + cards          | 200–400          |
| `apps/web/src/components/shell/Sidebar.tsx` | Lockup adaptativo + truncate + a11y | +80–150          |
| `apps/web/src/lib/i18n/strings.ts`          | Strings nuevas (ES + EN)            | +12–20           |
| `apps/web/src/app/styles/ui-kit.css`        | Clases nuevas reusables             | +50–150          |
| `apps/web/public/brand/`                    | Thumbnails SVG por demo (opcional)  | 5 archivos       |
| `apps/web/src/lib/branding/contrast.ts`     | Util de contraste WCAG (nuevo)      | +30–50           |

---

## 9. Cuando termines

1. Abrí un PR con base `main` (asumiendo que ya se mergeó el tren
   multi-tenant).
2. En el body del PR, incluí:
   - Screenshots del dashboard con 1, 3 y 5 demos (mostrar que la
     grilla se ve bien con cualquier cantidad).
   - Screenshots del sidebar con y sin branding custom.
   - Screenshot del empty state.
   - GIF corto del flujo: admin cambia accentColor → sidebar refleja en
     vivo.
3. Marcame para review.

---

## 10. Lo que queda para la Ola 3

Para que sepas en qué se desemboca esto:

- `/admin/tenant` con tabs (General / Demos / Branding), color picker
  visual con preview en vivo del sidebar, validación inline de
  contraste, manejo de errores del backend.
- Refinamiento de estados loading / error / empty del resto de la app
  (skeletons en lugar de placeholders).
- Error boundary global de auth.

---

## Referencias

- [Handoff Ola 1](./ola-1-login-header.md) — Login + header.
- [ADR-0013](../../adr/0013-multi-tenant-saas-architecture.md) — Diseño
  multi-tenant.
- [ADR-0015](../../adr/0015-multi-tenant-implementation-notes.md) —
  Notas de implementación del sprint.
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — Sistema de diseño completo.
- [tokens.css](../../../apps/web/src/app/styles/tokens.css) —
  Source-of-truth de los tokens.
