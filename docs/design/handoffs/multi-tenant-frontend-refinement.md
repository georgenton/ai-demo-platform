# Continuación de diseño — refinamiento de UI multi-tenant

> **Cómo usar este documento.** Pégalo (o sé Claude Design leyéndolo en
> el repo) al inicio de una conversación continuada con Claude Design,
> que ya conoce este proyecto desde el diseño inicial del frontend.
>
> No repetimos contexto de sistema de tokens ni decisiones que ya tomamos
> juntos — solo lo nuevo desde la última vez que conversamos.

---

## Hola, Claude Design — volvemos

Desde nuestra última conversación cerré el **sprint multi-tenant**
(PRs #60–#66). El frontend que diseñaste sigue siendo la base — la
sidebar, el header, los layouts del ui-kit, los tokens, las páginas de
demos: todo eso queda intacto y funciona.

Lo que pasó después de tu trabajo es que sumé **cuatro piezas nuevas**
que dejé como **stubs funcionales sin polish visual**, y necesito tu
ayuda para refinarlas a la calidad del resto del producto.

### Qué cambió técnicamente

| Área              | Antes (lo que lo que diseñaste)    | Después (sprint multi-tenant)                                   |
| ----------------- | ---------------------------------- | --------------------------------------------------------------- |
| Auth              | Basic auth a nivel deploy (Vercel) | Login email + password, JWT en cookie httpOnly, roles           |
| Tenancy           | Una instancia compartida           | Multi-tenant soft con `tenantId`; cada cliente con su DB row    |
| Catálogo de demos | 5 demos fijos en el sidebar        | Filtrado por industry → tenant override                         |
| Branding          | Fijo (NAI mint verde)              | Tenant puede overridear logoUrl + accentColor + displayName     |
| Theme             | Default `light` con toggle         | Sigue al sistema operativo (`prefers-color-scheme`) por default |
| Páginas nuevas    | —                                  | `/login`, `/admin/tenant`; `/` cambió de redirect a dashboard   |
| Header            | Demo activo + provider + toggles   | Mismo, **falta menú de usuario** (avatar + logout)              |

Tres principios que no cambian:

- Idioma del producto: **español neutro con "tú"** (Jorge es ecuatoriano,
  NO uses voseo argentino — sin `quieres`, `puedes`, `mirá`, `ve`, `ven`,
  `crees`, imperativos en `-á/-é/-í`).
- Branding default del producto: **verde NAI mint** (`--color-accent` ya
  apunta a `--nai-mint-500`).
- Tokens: usa los **reales** del ui-kit (`--color-bg`, `--color-fg`,
  `--space-N`, etc.). Hay un bug que documento abajo: los stubs que
  hice usan tokens **inexistentes** con fallbacks hardcoded. Fixearlos
  es parte de este trabajo.

---

## El trabajo, en un solo bloque

Cuatro piezas + un fix transversal. Todo va en un solo PR.

### Pieza 1 — `/login`

**Archivo:** `apps/web/src/app/login/page.tsx`

**Hoy:** form centrado básico, funcional pero sin diseño.

**Qué necesita:** primera impresión del cliente. Lo que ve antes de
entrar al producto. Polishing total del visual con la libertad que
quieras (split screen, hero, ilustración, microanimación) siempre
respetando los contratos.

**Contratos NO romper:**

```tsx
'use client';

import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { ApiError } from '@/lib/api/client';

// Mantener:
// 1. Wrapper <Suspense> alrededor del componente del form (Next 16
//    pide esto cuando se usa useSearchParams).
// 2. await auth.login({ email, password }).
// 3. En éxito, router.replace(searchParams.get('from') || '/').
//    El 'from' tiene que validarse: empezar con '/' y NO con '//'.
// 4. Catch de ApiError con status 401 → t('auth.login.error.invalid').
//    Cualquier otro error → t('auth.login.error.network').
```

**Strings i18n disponibles** (ES + EN, en `apps/web/src/lib/i18n/strings.ts`):

```
auth.login.title             auth.login.subtitle
auth.login.email             auth.login.emailPlaceholder
auth.login.password          auth.login.passwordPlaceholder
auth.login.submit            auth.login.submitting
auth.login.error.invalid     auth.login.error.network
```

Si necesitas más (footer legal, "olvidé contraseña" deshabilitado, copy
adicional), los agregas en el mismo PR en ambos idiomas.

---

### Pieza 2 — Header con menú de usuario (componente nuevo)

**Archivo:** `apps/web/src/components/shell/Header.tsx`

**Hoy:** el header tiene tres bloques: kicker de demo a la izquierda,
provider "Anthropic API → NAI on-prem" en el centro, `LangSwitch` +
`ThemeToggle` + `PresentationToggle` a la derecha. **Falta el menú de
usuario** — un usuario logueado no puede cerrar sesión salvo borrando
la cookie en DevTools.

**Qué agregar:** un botón con la inicial del usuario (o avatar) al
final de la fila derecha (después o antes del `PresentationToggle`,
decisión visual tuya), que al hacer click abre un dropdown con:

1. **Header del menú no clickeable:**
   - Nombre completo (`auth.user.displayName`).
   - Email (`auth.user.email`).
   - Tenant + industry (`auth.tenant.displayName · auth.tenant.industry.displayName`).
2. **Link al admin panel** (solo si `auth.user.role === 'admin' || 'superadmin'`):
   - Ruta: `/admin/tenant`.
3. **Botón cerrar sesión:** `await auth.logout()` — el `AuthProvider`
   limpia el estado y el middleware redirige a `/login` automáticamente.

**Contratos:**

```tsx
import { useAuth } from '@/lib/auth';

const auth = useAuth();
// Disponibles cuando auth.status === 'authenticated':
auth.user?.displayName; // string
auth.user?.email; // string
auth.user?.role; // 'member' | 'admin' | 'superadmin'
auth.tenant?.displayName; // string
auth.tenant?.industry.displayName;

await auth.logout();
```

**Strings nuevos a agregar** (en ambos idiomas):

```ts
'header.user.menu': 'Menú de cuenta' / 'Account menu',
'header.user.admin': 'Administración' / 'Administration',
'header.user.adminHint': 'Editar demos habilitados y branding' / 'Edit enabled demos and branding',
'header.user.role.member': 'Miembro' / 'Member',
'header.user.role.admin': 'Administrador' / 'Administrator',
'header.user.role.superadmin': 'Superadmin' / 'Superadmin',
// auth.logout ya existe (no duplicar).
```

**Libertades:** forma del botón (círculo con inicial, squircle, pill),
color del avatar (derivado de hash del email, monocromo, o del accent
por rol), tipo de dropdown (Radix UI, Headless UI, propio con focus
trap). Accesibilidad obligatoria: `role="menu"`, `aria-expanded`,
navegación con flechas, ESC cierra.

**NO toques:** los tres bloques existentes del header. El kicker del
demo activo y la lógica de detectar "demo activo" desde `usePathname()`
ya funcionan y los usamos en cada demo.

---

### Pieza 3 — `/` (dashboard)

**Archivo:** `apps/web/src/app/page.tsx`

**Hoy:** antes redirigía siempre a `/demo/rag`. Ahora es un dashboard
real con cards de los demos habilitados del tenant. El stub tiene
welcome con el nombre del user, subtitle con tenant + industry, y una
grilla CSS `auto-fill` de cards mínimo 280px.

**Qué necesita:**

- **Identidad visual por demo** (los 5 demos del catálogo no tienen
  ilustraciones hoy). Sugerencia inicial — ajusta si encuentras mejor
  armonía:
  - `rag` → `MessageSquare` (Lucide) + azul navy
  - `comparator` → `GitCompare` + ámbar
  - `corpus` → `Library` + violeta
  - `agent` → `Bot` + verde mint (el accent default)
  - `tutor` → `Mic` + rosa coral

- **Estados refinados:**
  - Loading: skeletons con shimmer (no texto plano).
  - Error: mensaje + CTA "Reintentar" que llama `refresh()` del hook.
  - Empty (sin demos habilitados): SVG ilustrado + mensaje cálido +
    sugerencia "Contacta al administrador".
  - Caso normal: la grilla con tus cards.

- **Welcome y subtitle:**
  - Badge del rol cerca del welcome si `auth.user.role === 'admin'`.
  - Indicador "Cartelera personalizada" si `data.overridden === true`
    — útil para que el admin sepa que está viendo una lista custom
    en lugar de la default de su industry.

**Contratos:**

```tsx
'use client';

import { useAuth, useMyDemos } from '@/lib/auth';
import type { MeDemo } from '@/lib/api/types-auth';

const auth = useAuth();
const { status, data, refresh } = useMyDemos();
// status: 'idle' | 'loading' | 'ready' | 'error'
// data.demos: MeDemo[]  ← itera sobre esto (no hardcodees los IDs)
// data.tenant.displayName, data.industry.displayName
// data.overridden: boolean

interface MeDemo {
  id: string; // 'rag' | 'comparator' | 'corpus' | 'agent' | 'tutor'
  title: string;
  tagline: string;
  description: string;
  audience: string[];
  status: 'available' | 'coming-soon';
  route: string; // ej. '/demo/rag'
}
```

**Strings i18n disponibles:**

```
dashboard.welcome              dashboard.subtitle
dashboard.empty.title          dashboard.empty.body
dashboard.openDemo             dashboard.loading           dashboard.error
```

**Sugeridos a agregar si la nueva UI los necesita:**

```ts
'dashboard.section.demos': 'Tus demos',
'dashboard.card.audience': 'Audiencia',
'dashboard.card.comingSoon': 'Próximamente',
'dashboard.error.retry': 'Reintentar',
'dashboard.overridden.badge': 'Cartelera personalizada',
```

**NO toques:** las rutas de demos (`demo.route` viene del backend con
guard `@RequireDemo`; cambiar las rutas rompe el acceso). Tampoco
asumas que siempre hay 5 demos — un tenant `salud` puede tener solo 2.

---

### Pieza 4 — Sidebar con branding del tenant (problemas concretos)

**Archivo:** `apps/web/src/components/shell/Sidebar.tsx`

**Hoy:** ya filtra demos por tenant (usa `useMyDemos`), aplica el
`accentColor` del tenant como `--color-accent` inline en el `<aside>`,
y muestra el `displayName` del tenant. Funciona end-to-end pero tiene
**tres problemas visibles**:

1. **Lockup inconsistente cuando hay logo del tenant.** Hoy: logo del
   tenant + `displayName` del tenant + tagline "NUTANIX ENTERPRISE AI"
   compiten visualmente — el cliente no sabe quién es el proveedor.
   **Solución:**
   - Con `branding.logoUrl`: el logo del tenant **es protagonista**
     arriba. Footer del sidebar con "Powered by NAI" + logo mark NAI
     pequeño + tagline.
   - Sin `branding.logoUrl`: lockup actual (logo NAI + nombre tenant),
     pero el logo NAI no debería competir con el tenant name (más
     sutil, menor, secundario).

2. **Nombres largos rompen el layout.** Hoy: "Universidad Técnica
   Particular de Loja — Sede Norte" desborda o se corta feo.
   **Solución:** truncar con elipsis + tooltip con el nombre completo
   al hover. Considerá dos líneas si el espacio lo permite.

3. **Accent color del tenant sin guarda de contraste.** Hoy: un admin
   puede setear `accentColor: '#FFFF00'` (amarillo casi blanco) y rompe
   la legibilidad del sidebar.
   **Solución:** calcular contraste WCAG del accent vs `--color-bg`
   del sidebar. Si está por debajo de AA, **caer al accent default del
   producto** (`--nai-mint-500`). Util de ~30 líneas con la fórmula
   estándar de luminancia. Sugerido en `apps/web/src/lib/branding/contrast.ts`.

**Health-dot del footer del sidebar:** hoy es estático. Bonus si lo
conectas a `GET /api/v1/health` con polling cada 30s — el dot pasa a
warn/danger si la respuesta deja de ser OK. Si te queda mucho, déjalo
para después.

**Contratos:**

```tsx
'use client';

import { useMyDemos } from '@/lib/auth';

const { data: meDemos } = useMyDemos();
// meDemos puede ser null durante loading inicial.
// Optimistic display: si no cargó, mostrar el catálogo completo
// hasta que llegue (ya está hecho en el código actual, mantener).

// Branding del tenant — leer defensive porque branding es JSON:
const branding = meDemos?.tenant.branding; // unknown
// Hacé un type guard antes de leer .logoUrl, .accentColor, .displayName.
// La función readBranding() existe en el código actual, puedes reusarla.
```

**Strings nuevos sugeridos:**

```ts
'shell.brand.poweredBy': 'Powered by NAI',
'shell.tenant.industry': 'Industria',  // si usás un tooltip
```

**NO toques:** el filtro por `enabledDemos` (regla multi-tenant
fundamental). Tampoco quites el `unoptimized` del `<Image>` del logo
del tenant — los logos vienen de dominios arbitrarios y Next romperia
el build sin esa prop.

---

### Pieza 5 — `/admin/tenant` (admin panel)

**Archivo:** `apps/web/src/app/admin/tenant/page.tsx`

**Hoy:** form vertical con `displayName`, checkboxes de `enabledDemos`,
campos sueltos de branding (accentColor, logoUrl, displayName).
Funcional pero crudo.

**Qué necesita:** form con **tres secciones claras** (tabs, accordion
o cards apiladas — tú decides):

1. **General** — `displayName` del tenant. Tal vez metadata del
   industry como solo-lectura.
2. **Demos habilitados** — checkboxes con mejor copy. Muestra la
   etiqueta "Heredado de tu industry" cuando `data.overridden === false`
   (porque desmarcando todo, el tenant hereda la default de la industry,
   no queda vacío).
3. **Branding** — con preview en vivo del sidebar mientras el admin
   ajusta:
   - `accentColor`: color picker visual (no input text con regex).
     Validación inline de contraste — si el color elegido falla WCAG
     AA contra el fondo, mostrá warning ("Este color tiene poco
     contraste; el sidebar va a usar el accent default").
   - `logoUrl`: input URL con preview de la imagen al lado.
   - `displayName` del branding: input con preview en vivo del lockup
     del sidebar al lado.

**Estados:**

- `saving`: botón deshabilitado, spinner inline.
- `saved`: banner verde "Cambios guardados" (timeout 3s o dismiss
  manual). Después del save, llamá `refresh()` del `useMyDemos` para
  que el sidebar refleje los cambios sin reload.
- `error`:
  - 403 → mensaje "No tienes permisos para editar este tenant".
  - 400 → mostrar el mensaje del backend (suele ser específico:
    "enabledDemos contiene IDs inválidos: X").
  - 500/network → "No se pudo guardar. Intenta de nuevo."

**Acceso por rol:** si `auth.user.role === 'member'`, mostrá el mismo
mensaje de "No tienes permisos" — no muestres el form. (El backend
igual rechaza con 403, esto es UX.)

**Contratos:**

```tsx
'use client';

import { useAuth, useMyDemos } from '@/lib/auth';
import { updateMyTenant } from '@/lib/api/admin';
import type { UpdateTenantRequest } from '@/lib/api/types-admin';

const auth = useAuth();
const { data: meDemos, refresh } = useMyDemos();

await updateMyTenant({
  displayName?: string,
  enabledDemos?: string[],   // IDs del catálogo
  branding?: {
    logoUrl?: string,
    accentColor?: string,    // hex #RRGGBB
    displayName?: string,
  },
});
// Backend mergea el branding NO destructivo — puedes mandar solo
// accentColor sin perder logoUrl previo.
```

**Strings i18n disponibles:**

```
admin.title                    admin.subtitle
admin.displayName.label
admin.enabledDemos.label       admin.enabledDemos.hint
admin.branding.title           admin.branding.accentColor
admin.branding.logoUrl         admin.branding.displayName
admin.save                     admin.saving                admin.saved
admin.error.forbidden          admin.error.generic
```

**Sugeridos a agregar:**

```ts
'admin.section.general': 'General',
'admin.section.demos': 'Demos',
'admin.section.branding': 'Branding',
'admin.branding.preview': 'Vista previa',
'admin.branding.contrast.warning': 'Este color tiene poco contraste; el sidebar usará el accent default.',
'admin.enabledDemos.inherited': 'Heredado de tu industria ({industry})',
```

---

### Pieza transversal — Fix del bug de tokens en los stubs

Cuando hice los stubs de las 4 piezas, usé nombres de tokens
**inventados** con fallbacks hardcoded. Los stubs se ven OK porque
caen al hex literal, pero ningún cambio de theme o branding aplica
realmente.

Tabla de conversión obligatoria:

| Stub usa                         | No existe | Token real                                            |
| -------------------------------- | --------- | ----------------------------------------------------- |
| `var(--surface-bg, #0c1418)`     | ❌        | `var(--color-bg)`                                     |
| `var(--surface-card, #131e23)`   | ❌        | `var(--color-bg-elevated)` o `var(--color-surface)`   |
| `var(--surface-input, #0c1418)`  | ❌        | `var(--color-bg-sunken)`                              |
| `var(--text-strong, #f0f5f8)`    | ❌        | `var(--color-fg)`                                     |
| `var(--text-default, #c5d1d8)`   | ❌        | `var(--color-fg)`                                     |
| `var(--text-muted, #87969f)`     | ❌        | `var(--color-fg-muted)`                               |
| `var(--text-danger, #ff6b7a)`    | ❌        | `var(--color-danger)`                                 |
| `var(--accent-default, #43c194)` | ❌        | `var(--color-accent)`                                 |
| `var(--border-default, #1f2c33)` | ❌        | `var(--color-border)`                                 |
| `var(--spacing-N, *)`            | ❌        | `var(--space-N)` (escala de 4px que ya conoces)       |
| `var(--font-size-*, *)`          | ❌        | font-size directo o agregar token en `tokens.css`     |
| `var(--radius-md, 8px)`          | ✅ existe | `var(--radius-md)` (es 6px, no 8px — corregí valor)   |
| `var(--radius-lg, 12px)`         | ✅ existe | `var(--radius-lg)` (es 10px, no 12px — corregí valor) |

**Mejor que migrar inline styles uno por uno:** mové los estilos a
`ui-kit.css` con clases reutilizables (`.login-form`, `.dashboard-grid`,
`.demo-card`, `.user-menu`, `.admin-form`) siguiendo el patrón de
`.sidebar`, `.header`, `.demo-item` que ya usaste antes.

---

## Cómo verificar antes de cerrar tu PR

```bash
npm test                                    # >= 348/348
npm run lint
npx tsc --noEmit -p apps/web/tsconfig.json
npx nx build web
```

### Smoke local end-to-end

```bash
# Solo la primera vez (si la DB está limpia):
npm run db:seed:tenants
npm run db:seed:demos     # requiere backend corriendo

# Después:
npx nx serve api          # terminal 1
PORT=4200 npx nx dev web  # terminal 2
```

Checklist en `http://localhost:4200`:

1. Pestaña incógnita → te redirige a `/login?from=/`.
2. Loguea con `admin@nai.local` / `demo-platform-2026`.
3. **Esperado:** dashboard con cards de los 5 demos del tenant `demo`
   (industry universidad).
4. **Header:** menú de usuario visible, click → email + tenant + link
   admin + logout.
5. **Sidebar:** logo NAI default + "Demo · Tenant interno NAI" como
   displayName (sin override hoy).
6. Click en logout → redirige a `/login`, cookie borrada.
7. Vuelve a loguear, ve a `/admin/tenant`.
8. Cambia `accentColor` a `#FF6600`, `logoUrl` a
   `https://placehold.co/64`, `displayName` del branding a "UTPL".
9. Guarda → ver banner "Cambios guardados", sidebar refrescado en vivo.
10. Cambia `accentColor` a `#FFFFAA` (amarillo bajo contraste). Guarda
    → tu UI debería advertir, y el sidebar caer al accent default.
11. Desmarcá todos los demos. Guarda. Vuelve a `/`.
12. **Esperado:** empty state.
13. Probá ambos themes: macOS en modo oscuro al cargar → app arranca
    en dark. Click manual al toggle del header → respeta tu elección
    aunque cambies el OS.

---

## Archivos que tocás

| Archivo                                           | Acción                              |
| ------------------------------------------------- | ----------------------------------- |
| `apps/web/src/app/login/page.tsx`                 | Rewrite completo                    |
| `apps/web/src/app/page.tsx`                       | Rewrite completo                    |
| `apps/web/src/app/admin/tenant/page.tsx`          | Rewrite del form con secciones      |
| `apps/web/src/components/shell/Header.tsx`        | Sumar menú de usuario               |
| `apps/web/src/components/shell/Sidebar.tsx`       | Lockup adaptativo + truncate + WCAG |
| `apps/web/src/lib/i18n/strings.ts`                | Agregar strings (ES + EN)           |
| `apps/web/src/app/styles/ui-kit.css`              | Clases reusables nuevas             |
| `apps/web/src/lib/branding/contrast.ts`           | Util WCAG (nuevo)                   |
| `apps/web/public/brand/` o `apps/web/src/assets/` | SVGs de identidad por demo          |

---

## Cuando termines

Un solo PR contra `main` con todo. En el body:

1. Screenshots side-by-side (antes/después) de cada pieza en light + dark.
2. Screenshots del sidebar con y sin branding custom.
3. Screenshot del admin panel con preview en vivo.
4. GIF corto: admin cambia accent → sidebar refresca; admin pone color
   ilegible → warning + fallback.
5. Confirmación de los 4 comandos de verificación pasando.

Márcame para review.

---

## Referencias rápidas

- [ADR-0013](../../adr/0013-multi-tenant-saas-architecture.md) — Diseño
  multi-tenant (regla de herencia industry → tenant).
- [ADR-0015](../../adr/0015-multi-tenant-implementation-notes.md) —
  Decisiones de implementación del sprint (guards, 404 vs 403, etc.).
- [tokens.css](../../../apps/web/src/app/styles/tokens.css) — Sistema
  de tokens del ui-kit (los reales, no los inventados).
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — Lo que lo que diseñaste
  inicialmente; sigue siendo la base.
