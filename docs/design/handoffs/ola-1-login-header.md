# Handoff a Claude Design — Ola 1 (login + header con menú de usuario)

> **Propósito de este documento.** Este es el primer handoff visual del
> sprint multi-tenant. Define exactamente qué piezas rediseñar, qué
> contratos no romper, qué tokens del ui-kit usar y qué libertades quedan
> abiertas. Pegalo entero a Claude Design como input — es self-contained.
>
> **Estado:** Pendiente de implementación por Claude Design.
> **Sprint relacionado:** PRs #60–#66 (multi-tenant MT1..MT7-prep).
> **Próxima ola:** Ola 2 — dashboard `/` + sidebar branding (después de
> que esta cierre).

---

## 1. Contexto

Acabo de cerrar el sprint multi-tenant del backend y dejé tres páginas
nuevas en el frontend con **UI mínima funcional pero sin polish**:

- `/login` — formulario de inicio de sesión.
- `/` (dashboard) — cards de los demos habilitados del tenant.
- `/admin/tenant` — admin panel para editar branding + enabledDemos.

Y el shell de la app (header + sidebar) ahora maneja branding por tenant
pero **el header no tiene avatar ni menú de logout** — un usuario
logueado solo puede cerrar sesión vía DevTools borrando la cookie.
Está incompleto.

Esta ola cubre las dos piezas más críticas en este momento:

1. **`/login`** — primera impresión del cliente. Cuando un nuevo cliente
   abre la URL por primera vez, esto es lo único que ve hasta que
   ingresa credenciales.
2. **Header del shell con menú de usuario** — está presente en cada
   pantalla. Sin esto, no hay forma "normal" de cerrar sesión, ni de ver
   en qué tenant estás logueado.

---

## 2. Decisiones de producto ya tomadas

Estas decisiones las acordamos antes del handoff. **No las re-discutas**
con el cliente — vienen del owner del producto.

| Decisión                      | Implementación                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branding default del producto | Verde NAI `--nai-mint-500` (ya está en `tokens.css` como `--color-accent`).                                                                           |
| Idioma de la app              | Español por default; switch EN/ES en el header.                                                                                                       |
| Tema                          | Sigue al sistema operativo (`prefers-color-scheme`) cuando el usuario no eligió manualmente. Toggle en el header.                                     |
| Branding por tenant           | El sidebar puede tener `accentColor`, `logoUrl`, `displayName` custom. El header **no se brandea por tenant** (mantiene el producto NAI consistente). |

---

## 3. Pieza A — `/login`

### Archivo a tocar

`apps/web/src/app/login/page.tsx`

### Estado actual (stub funcional)

Es un form centrado con tokens del ui-kit incorrectos (ver sección 6).
Funciona end-to-end: email + password → `useAuth().login()` → redirect
a `?from` o `/`. Maneja errores 401 (credenciales) y network/5xx
(servidor caído).

### Contratos — NO TOCAR

```tsx
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

// Hooks que ya están disponibles y deben seguir usándose:
const { t } = useT(); // i18n
const auth = useAuth(); // expone .login(), .status, .user, .tenant
const searchParams = useSearchParams(); // para leer ?from=

// Lo que el form DEBE seguir haciendo:
// 1. Llamar await auth.login({ email, password })
// 2. En éxito, redirect a searchParams.get('from') o '/'
// 3. Validar que el `from` empiece con '/' y no con '//' (defensa contra open redirect)
// 4. En error 401, mostrar t('auth.login.error.invalid')
// 5. En error network/5xx, mostrar t('auth.login.error.network')
```

### Strings i18n disponibles (ES + EN ya en `strings.ts`)

```
auth.login.title             → "Iniciar sesión" / "Sign in"
auth.login.subtitle          → "AI Demo Platform — Nutanix Enterprise AI"
auth.login.email             → "Correo" / "Email"
auth.login.emailPlaceholder  → "tu@dominio.com"
auth.login.password          → "Contraseña" / "Password"
auth.login.passwordPlaceholder → "Tu contraseña"
auth.login.submit            → "Entrar" / "Sign in"
auth.login.submitting        → "Verificando…" / "Verifying…"
auth.login.error.invalid     → "Credenciales inválidas..." / "Invalid credentials..."
auth.login.error.network     → "No se pudo contactar al servidor..." / "Could not reach..."
```

Si necesitas strings nuevas (ej. footer legal, "olvidé mi contraseña"
deshabilitado), las **agregas en el mismo PR** en ambos idiomas
(`STRINGS_ES` y `STRINGS_EN` en `apps/web/src/lib/i18n/strings.ts`).

### Libertades creativas

Esto es lo que **sí** puedes cambiar libremente:

- **Layout completo**: split-screen (form a la derecha, hero a la
  izquierda), centrado, fullscreen, lo que sea.
- **Background art**: ilustración, gradient, foto, video silencioso —
  pero **rinde bien también en light mode** (no asumas dark only).
- **Marca**: el logo NAI debería estar presente y reconocible (assets
  en `public/brand/`).
- **Microanimaciones**: fade-in del form, blur del bg mientras carga,
  shake en error de credenciales — siempre con `prefers-reduced-motion`
  respetado.
- **Copy adicional**: footer con links a docs/soporte, badge "Servicio
  en línea", una frase emotiva — siempre con string en `strings.ts`.
- **Responsive**: mobile-first si tiene sentido. Aunque el cliente
  típico usa laptop, los administradores pueden necesitar entrar desde
  el celular.

### Referencias visuales (sugeridas)

- **Linear** — split clean, hero con marca grande.
- **Vercel** — minimal, mucho aire, microanimación de blur.
- **Stripe Dashboard** — form preciso, errores inline elegantes.

### Lo que NO puedes hacer

- Cambiar el shape del fetch (`/api/v1/auth/login`, JSON, etc.) — eso
  rompe el backend.
- Quitar `'use client'` (la página depende de hooks de React).
- Romper el flujo de redirect post-login (el `?from` es importante para
  que cuando un user pierde la sesión en medio de un demo, vuelva donde
  estaba).
- Eliminar el `<Suspense>` que envuelve el form — Next 16 lo necesita
  para `useSearchParams`.

---

## 4. Pieza B — Header con menú de usuario

### Archivo a tocar

`apps/web/src/components/shell/Header.tsx`

### Estado actual

El header tiene tres bloques:

- **Izquierda:** "DEMO · 01 · Chat con documentos" (kicker + nombre del
  demo activo).
- **Centro:** "Anthropic API → NAI on-prem" + badge `dev` (decorativo).
- **Derecha:** `LangSwitch`, `ThemeToggle`, `PresentationToggle`.

**Lo que falta:** un control de usuario logueado. Hoy un usuario no
puede:

- Saber con qué cuenta está logueado a simple vista.
- Cerrar sesión (la única forma es borrar la cookie en DevTools).
- Saber a qué tenant pertenece.
- Ir al admin panel si es admin.

### Lo que tienes que agregar

Un nuevo control en la derecha del header (después del
`PresentationToggle` o antes, decisión visual tuya): un botón con la
**inicial del usuario** o avatar, que al hacer click abre un menú con:

1. **Sección de contexto** (header del menú, no clickeable):
   - Nombre completo del usuario (`user.displayName`).
   - Email del usuario (`user.email`).
   - Tenant + industry (`tenant.displayName · tenant.industry.displayName`).
2. **Link al admin panel** — solo si `user.role === 'admin' || 'superadmin'`.
   Ruta: `/admin/tenant`.
3. **Botón cerrar sesión** (`auth.logout`).
   Al click: `await useAuth().logout()` → la app redirige a `/login`
   automáticamente (el middleware se encarga).

### Contratos — NO TOCAR

```tsx
import { useAuth } from '@/lib/auth';

const auth = useAuth();
// Disponibles cuando auth.status === 'authenticated':
auth.user?.displayName; // string
auth.user?.email; // string
auth.user?.role; // 'member' | 'admin' | 'superadmin'
auth.tenant?.displayName; // string
auth.tenant?.industry.displayName; // string

// La acción de logout:
await auth.logout();
// Limpia la cookie en el backend y el estado en el AuthProvider.
// El middleware redirige a /login automáticamente en el próximo navigation.
```

**Para el link al admin**:

```tsx
import Link from 'next/link';

<Link href="/admin/tenant">{t('header.user.admin')}</Link>;
```

### Strings i18n a agregar

Las agregas en `apps/web/src/lib/i18n/strings.ts` (en `STRINGS_ES` y
`STRINGS_EN`):

```ts
// En STRINGS_ES:
'header.user.menu': 'Menú de cuenta',
'header.user.admin': 'Administración',
'header.user.adminHint': 'Editar demos habilitados y branding',
'header.user.role.member': 'Miembro',
'header.user.role.admin': 'Administrador',
'header.user.role.superadmin': 'Superadmin',

// En STRINGS_EN:
'header.user.menu': 'Account menu',
'header.user.admin': 'Administration',
'header.user.adminHint': 'Edit enabled demos and branding',
'header.user.role.member': 'Member',
'header.user.role.admin': 'Administrator',
'header.user.role.superadmin': 'Superadmin',

// Estas ya existen, NO duplicar:
// 'auth.logout' → "Cerrar sesión" / "Sign out"
```

### Libertades creativas

- **Forma del botón**: círculo con inicial, círculo con foto (no
  tenemos fotos hoy, queda futuro), Squircle, pill.
- **Color del avatar**: derivado del email (hash → color), del accent
  default, o monocromo.
- **Dropdown o popover**: Radix UI, Headless UI, implementación propia
  con focus trap. Lo importante es accesibilidad
  (`role="menu"`, `aria-expanded`, navegación con flechas, ESC cierra).
- **Indicador de rol**: badge al lado del nombre, color del border del
  avatar, ícono.
- **Animaciones**: el menú aparece con fade-in/scale, respeta
  `prefers-reduced-motion`.

### Componentes UI ya disponibles

```tsx
import { Badge, Icon } from '@/components/ui';

<Badge tone="info">{t('header.user.role.admin')}</Badge>
<Icon name="user" size={14} />
// `Icon` viene de lucide-react. Lista de iconos:
// https://lucide.dev/icons
```

### Lo que NO puedes hacer

- Borrar los controles existentes del header (`LangSwitch`,
  `ThemeToggle`, `PresentationToggle`) — son funcionales y se usan.
- Cambiar la lógica de "demo activo" del kicker izquierdo.
- Eliminar el bloque decorativo del centro ("Anthropic API → NAI") —
  es parte del mensaje comercial del producto.
- Renderizar el menú cuando `auth.status !== 'authenticated'` — el
  shell solo se monta para users logueados, pero defensive: si por
  alguna razón llega sin sesión, no mostrés el menú (no rompe).

---

## 5. Sistema de tokens disponible

Los stubs que dejé usan tokens **equivocados** (ver sección 6). Estos
son los tokens **reales** del ui-kit. Úsalos siempre con `var(--token)`
sin fallback hardcoded.

### Colores (light theme — automático en dark via `[data-theme="dark"]`)

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
--color-border          /* default */
--color-border-strong   /* en focus o hover marcado */
--color-border-subtle   /* dividers tenues */
--color-border-focus    /* outline del focus ring */

/* Foreground (texto) */
--color-fg              /* texto primario */
--color-fg-muted        /* texto secundario, captions */
--color-fg-subtle       /* metadata, hints */
--color-fg-disabled
--color-fg-inverse      /* texto sobre fondos oscuros */
--color-fg-link

/* Marca */
--color-accent          /* verde NAI mint */
--color-accent-fg       /* texto sobre el accent */
--color-accent-soft     /* fondo soft del accent (badges) */
--color-brand           /* navy del logo */
--color-brand-fg

/* Estados */
--color-success / --color-success-bg
--color-warn    / --color-warn-bg
--color-danger  / --color-danger-bg
--color-info    / --color-info-bg
```

### Espaciado (escala de 4px)

```css
--space-0  /* 0 */
--space-1  /* 4px */
--space-2  /* 8px */
--space-3  /* 12px */
--space-4  /* 16px */
--space-5  /* 20px */
--space-6  /* 24px */
--space-8  /* 32px */
--space-10 /* 40px */
--space-12 /* 48px */
--space-16 /* 64px */
--space-24 /* 96px */
```

### Radios

```css
--radius-xs    /* 2px  — chips */
--radius-sm    /* 4px  — inputs pequeños */
--radius-md    /* 6px  — botones, inputs */
--radius-lg    /* 10px — cards */
--radius-xl    /* 16px — modales */
--radius-2xl   /* 20px — hero */
--radius-pill  /* 999px — píldoras */
```

### Sombras

```css
--shadow-xs    /* hairline */
--shadow-sm    /* sutil */
--shadow-md    /* card elevada */
--shadow-lg    /* modal */
--shadow-inset /* inputs hundidos */
--shadow-focus /* outline del focus accesible */
```

### Tipografías

```css
--font-sans    /* default — Inter o similar */
--font-mono    /* JetBrains Mono o similar */
--font-serif   /* IBM Plex Serif — útil para headlines elegantes en /login */
```

---

## 6. ⚠️ Bug en los stubs actuales

Los stubs de `/login`, `/` y `/admin/tenant` usan tokens **inexistentes**
con fallbacks hardcoded:

| Stub usa                         | No existe | Token real                                          |
| -------------------------------- | --------- | --------------------------------------------------- |
| `var(--surface-bg, #0c1418)`     | ❌        | `var(--color-bg)`                                   |
| `var(--surface-card, #131e23)`   | ❌        | `var(--color-bg-elevated)` o `var(--color-surface)` |
| `var(--surface-input, #0c1418)`  | ❌        | `var(--color-bg-sunken)`                            |
| `var(--text-strong, #f0f5f8)`    | ❌        | `var(--color-fg)`                                   |
| `var(--text-default, #c5d1d8)`   | ❌        | `var(--color-fg)`                                   |
| `var(--text-muted, #87969f)`     | ❌        | `var(--color-fg-muted)`                             |
| `var(--text-danger, #ff6b7a)`    | ❌        | `var(--color-danger)`                               |
| `var(--accent-default, #43c194)` | ❌        | `var(--color-accent)`                               |
| `var(--border-default, #1f2c33)` | ❌        | `var(--color-border)`                               |
| `var(--spacing-N, *)`            | ❌        | `var(--space-N)`                                    |
| `var(--font-size-*, *)`          | ❌        | usar `font-size: 14px` directo o agregar el token   |
| `var(--radius-md, 8px)`          | ✅ existe | `var(--radius-md)` (6px, no 8px)                    |
| `var(--radius-lg, 12px)`         | ✅ existe | `var(--radius-lg)` (10px, no 12px)                  |

**Parte del trabajo de la Ola 1** es migrar los inline styles de
`/login` y el `Header.tsx` modificado a los tokens reales. Para `/` y
`/admin/tenant`, eso lo cubre la Ola 2 (no es responsabilidad de esta
ola, pero te lo aviso).

Mejor todavía: en lugar de inline styles, **mover los estilos del nuevo
form a `ui-kit.css` con clases reutilizables** (siguiendo el patrón del
sidebar y el header existentes que usan `.sidebar`, `.header`, etc.).

---

## 7. Cómo verificar antes de hacer push

```bash
# Tests no deben romperse — la lógica del provider no cambia.
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

1. **Antes** de tocar nada: `npm run db:seed:tenants` (si nunca corriste
   los seeds del sprint multi-tenant).
2. `npx nx serve api` en una terminal.
3. `PORT=4200 npx nx dev web` en otra.
4. Abrí pestaña incógnita en `http://localhost:4200/`.
5. **Esperado:** redirect a `/login?from=/`.
6. Loguea con `admin@nai.local` / `demo-platform-2026`.
7. **Esperado:** redirect a `/` (dashboard con cards).
8. Probá el menú de usuario:
   - Aparecer la inicial/avatar del user.
   - Click → menú con email, tenant, link admin, logout.
   - Click en "Cerrar sesión" → redirect a `/login`.
9. **Esperado:** cookie `auth` borrada, no podés acceder a `/` sin
   loguear de nuevo.
10. Probá ambos themes:
    - macOS en modo oscuro: `/login` debe arrancar en dark.
    - macOS en modo claro: en light.
    - Toggle manual en header → respeta tu elección incluso al
      cambiar el OS.

---

## 8. Resumen de archivos que tocás

| Archivo                                    | Acción                             | Líneas estimadas |
| ------------------------------------------ | ---------------------------------- | ---------------- |
| `apps/web/src/app/login/page.tsx`          | Rewrite completo                   | 100–250          |
| `apps/web/src/components/shell/Header.tsx` | Sumar menú de usuario              | +50–100          |
| `apps/web/src/lib/i18n/strings.ts`         | Agregar keys nuevas (ES + EN)      | +12              |
| `apps/web/src/app/styles/ui-kit.css`       | (opcional) clases nuevas reusables | variable         |

---

## 9. Cuando termines

1. Abrí un PR con base `feat/mt7-prep-theme-system` (o `main` si ya se
   mergeó el tren multi-tenant).
2. En el body del PR, incluí:
   - Screenshot del login en light y en dark.
   - Screenshot del header con el menú abierto.
   - GIF corto del logout flow.
3. Marcame para review.

---

## Referencias

- [ADR-0013](../../adr/0013-multi-tenant-saas-architecture.md) — Diseño
  multi-tenant.
- [ADR-0015](../../adr/0015-multi-tenant-implementation-notes.md) —
  Notas de implementación del sprint.
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — Sistema de diseño completo.
- [tokens.css](../../../apps/web/src/app/styles/tokens.css) —
  Source-of-truth de los tokens.
