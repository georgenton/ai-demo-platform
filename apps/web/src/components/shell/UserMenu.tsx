// -----------------------------------------------------------------------------
// UserMenu — botón con la inicial del usuario que abre un dropdown con
// información de la sesión y las acciones de cuenta.
//
// Estructura del dropdown:
//   ┌────────────────────────────────┐
//   │ Nombre del usuario             │ ← user-menu-head (no clickeable)
//   │ email@dominio.com              │
//   │ [Badge del rol]                │
//   │ Tenant · Industria             │
//   ├────────────────────────────────┤
//   │ ⚙ Administración               │ ← solo si rol >= admin
//   │   Editar demos habilitados y…  │
//   ├────────────────────────────────┤
//   │ ⏻ Cerrar sesión                │ ← danger color
//   └────────────────────────────────┘
//
// Accesibilidad (obligatoria, viene del handoff):
//   - role="menu" en el panel.
//   - aria-haspopup="menu" + aria-expanded en el botón.
//   - Navegación con flechas ↑/↓ entre items.
//   - ESC cierra y devuelve foco al botón.
//   - Click afuera cierra.
//
// Implementación SIN librería externa de dropdown — el alcance es chico y
// agregar Radix UI / Headless UI sumaría peso de bundle sin beneficio.
// El focus trap manual es suficiente para 1–2 items.
// -----------------------------------------------------------------------------

'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { Badge, Icon } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';

/**
 * Mapeo del rol del usuario al key i18n del label visible. Centralizado
 * porque lo usan el badge + el aria-label del botón.
 */
const ROLE_LABEL: Record<'member' | 'admin' | 'superadmin', StringKey> = {
  member: 'header.user.role.member',
  admin: 'header.user.role.admin',
  superadmin: 'header.user.role.superadmin',
};

const ROLE_BADGE_TONE: Record<
  'member' | 'admin' | 'superadmin',
  'neutral' | 'success' | 'info'
> = {
  member: 'neutral',
  admin: 'success',
  superadmin: 'info',
};

/**
 * Inicial del usuario para mostrar en el avatar. Toma la primera letra del
 * `displayName`; si no hay, del `email`. Mayúscula y máximo 2 caracteres.
 */
function getInitials(displayName?: string, email?: string): string {
  const source = (displayName || email || '?').trim();
  // Si tiene espacio, agarra la inicial de la primera y la última palabra.
  // Si no, solo la primera letra. Cubre "Jorge Quizamán" → "JQ" y
  // "admin@nai.local" → "A".
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.charAt(0).toUpperCase();
}

export function UserMenu() {
  const { t } = useT();
  const auth = useAuth();
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Solo renderizamos cuando hay sesión authenticated. Si no, devolvemos null
  // — defensive: el shell solo se monta para users logueados pero por si
  // llega sin sesión por una transición.
  const user = auth.user;
  const tenant = auth.tenant;

  // Cerrar al hacer click fuera del menú.
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // ESC cierra y devuelve foco al botón. Flechas navegan entre menuitems.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          [],
      );
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'ArrowDown'
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  }, []);

  // Al abrir, mueve el foco al primer item del menú para que la navegación
  // con teclado sea natural.
  useEffect(() => {
    if (!open) return;
    const firstItem =
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [open]);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    await auth.logout();
    // El middleware redirige a /login en la próxima navegación; no llamamos
    // a router.replace acá para no duplicar redirects.
  }, [auth]);

  if (!user || !tenant) return null;

  const role = user.role;
  const initials = getInitials(user.displayName, user.email);
  const isAdmin = role === 'admin' || role === 'superadmin';

  return (
    <div ref={containerRef} className="user-menu" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="avatar-btn"
        data-role={role}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.user.menu')}
        onClick={() => setOpen((v) => !v)}
      >
        {initials}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="user-menu-panel"
          role="menu"
          aria-label={t('header.user.menu')}
        >
          <div className="user-menu-head">
            <div className="user-menu-name">{user.displayName}</div>
            <div className="user-menu-email">{user.email}</div>
            <div className="user-role-badge">
              <Badge tone={ROLE_BADGE_TONE[role]}>{t(ROLE_LABEL[role])}</Badge>
            </div>
            <div className="user-menu-tenant">
              <Icon name="building-2" className="ic" />
              {tenant.displayName} · {tenant.industry.displayName}
            </div>
          </div>

          {isAdmin && (
            <>
              <Link
                href="/admin/tenant"
                className="user-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Icon name="sliders-horizontal" className="ic" />
                <span>
                  {t('header.user.admin')}
                  <span className="sub">{t('header.user.adminHint')}</span>
                </span>
              </Link>
              <div className="user-menu-sep" />
            </>
          )}

          <button
            type="button"
            className="user-menu-item danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <Icon name="log-out" className="ic" />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
