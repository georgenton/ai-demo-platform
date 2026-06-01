// -----------------------------------------------------------------------------
// Sidebar — navegación principal a la izquierda.
//
// Estructura del kit:
//   - Brand lockup arriba (logo mark + nombre + tagline NUTANIX ENTERPRISE AI).
//   - Lista de demos con icono, título, tagline y badge "Pronto" si
//     status='coming-soon'.
//   - Health dot abajo (estado del servicio).
//
// El item activo se deriva de `usePathname()` matcheando contra `route` del
// catálogo. Soportamos sub-rutas (ej. /demo/rag/foo también marca RAG activo)
// con `startsWith`.
// -----------------------------------------------------------------------------

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { Icon } from '@/components/ui';
import { useMyDemos } from '@/lib/auth';
import { buildSidebarDemos, type SidebarDemoItem } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/**
 * Branding del tenant aceptado por la UI. Lo extraemos defensive porque
 * tenant.branding es `unknown` (JSON Postgres) — chequeamos shape antes de
 * leer cada campo. Si algún campo viene corrupto, lo ignoramos y usamos el
 * default del ui-kit (no se rompe el render).
 */
interface SidebarBranding {
  accentColor?: string;
  logoUrl?: string;
  displayName?: string;
}

function readBranding(raw: unknown): SidebarBranding {
  if (!raw || typeof raw !== 'object') return {};
  const b = raw as Record<string, unknown>;
  return {
    accentColor:
      typeof b.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(b.accentColor)
        ? b.accentColor
        : undefined,
    logoUrl: typeof b.logoUrl === 'string' ? b.logoUrl : undefined,
    displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
  };
}

export function Sidebar() {
  const { t, lang } = useT();
  const { theme } = useTheme();
  const pathname = usePathname();
  // useMyDemos depende de useAuth — si no hay sesión devuelve idle/null.
  // El Sidebar vive bajo (shell)/layout, ya autenticado (middleware redirige).
  const { data: meDemos } = useMyDemos();

  // Filtramos el catálogo de la UI a los demos habilitados para el tenant.
  // Si meDemos todavía no cargó, mostramos el catálogo completo —
  // optimistic display, evita un flash de "sidebar vacío" inicial.
  const allDemos = useMemo(() => buildSidebarDemos(t), [t, lang]);
  const demos = useMemo(() => {
    if (!meDemos) return allDemos;
    const enabled = new Set(meDemos.demos.map((d) => d.id));
    return allDemos.filter((d) => enabled.has(d.id));
  }, [allDemos, meDemos]);

  // Branding: nombre, color de acento, logo. Defaults a "AI Demo Platform"
  // y al logo NAI si el tenant no overridea nada.
  const branding = readBranding(meDemos?.tenant.branding);
  const displayName =
    branding.displayName ?? meDemos?.tenant.displayName ?? 'AI Demo Platform';

  // El logo del kit varía con el tema; si el tenant trae un logoUrl
  // custom, lo usamos en ambos temas (responsabilidad del admin elegir
  // un logo que se vea bien en dark/light).
  const defaultLogo =
    theme === 'dark' ? '/brand/logo-mark-on-dark.svg' : '/brand/logo-mark.svg';
  const logoSrc = branding.logoUrl ?? defaultLogo;

  // accentColor del tenant se inyecta como CSS var inline solo en el
  // <aside>. Cualquier elemento del sidebar que use --color-accent (los
  // demo-item active, el badge, etc.) lo hereda. El resto de la app no se
  // ve afectado.
  const accentOverride: React.CSSProperties | undefined = branding.accentColor
    ? ({ ['--color-accent']: branding.accentColor } as React.CSSProperties)
    : undefined;

  return (
    <aside className="sidebar" style={accentOverride}>
      <div className="sidebar-brand">
        <Image
          src={logoSrc}
          width={32}
          height={32}
          alt=""
          aria-hidden
          priority
          // Los logos custom de tenants son arbitrarios (cualquier dominio);
          // unoptimized evita que Next intente bajarlos y procesarlos en
          // build-time. El default del kit sigue usando el optimizer.
          unoptimized={!!branding.logoUrl}
          style={{ display: 'block' }}
        />
        <div>
          <div className="sidebar-brand-name">{displayName}</div>
          <div className="sidebar-brand-tag">{t('shell.brand.tag')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="sidebar-section-label">{t('shell.demos')}</div>
        {demos.map((demo) => (
          <DemoItem
            key={demo.id}
            demo={demo}
            active={pathname?.startsWith(demo.route) ?? false}
            comingLabel={t('shell.coming')}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <ServiceStatus />
    </aside>
  );
}

interface DemoItemProps {
  demo: SidebarDemoItem;
  active: boolean;
  comingLabel: string;
}

function DemoItem({ demo, active, comingLabel }: DemoItemProps) {
  // Todos los items son navegables — coming-soon abre una página teaser
  // (Corpus). El kit usa <button>, nosotros usamos <Link> para que Next
  // pre-fetche la ruta y la navegación sea client-side, sin reload.
  return (
    <Link
      href={demo.route}
      className={['demo-item', active && 'active'].filter(Boolean).join(' ')}
      style={{ textDecoration: 'none' }}
    >
      <Icon name={demo.icon} size={18} className="demo-item-icon" />
      <div className="demo-item-body">
        <div className="demo-item-title">
          {demo.title}
          {demo.status === 'coming-soon' && (
            <span
              className="badge badge-info"
              style={{ fontSize: 9.5, padding: '1px 6px' }}
            >
              {comingLabel}
            </span>
          )}
        </div>
        <div className="demo-item-sub">{demo.tagline}</div>
      </div>
    </Link>
  );
}

/**
 * "Servicio activo" — dot pulsante + texto al pie del sidebar. Hoy es
 * estático (mismo behavior que el kit). Cuando queramos hacerlo "vivo",
 * llamamos `GET /api/v1/health` con SWR y derivamos el color del dot del
 * payload. Lo dejo afuera del scope de este PR — el dot ya transmite la
 * sensación de "todo OK" gracias a la animación pulse del ui-kit.css.
 */
function ServiceStatus() {
  const { t } = useT();
  return (
    <div
      style={{
        padding: '10px 8px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11,
        color: 'var(--color-fg-muted)',
      }}
    >
      <div className="health-dot" />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: 'var(--color-fg)', fontWeight: 500 }}>
          {t('shell.servicio')}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {t('shell.servicio.meta')}
        </span>
      </div>
    </div>
  );
}
