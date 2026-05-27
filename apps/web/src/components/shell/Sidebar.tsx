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
import { buildSidebarDemos, type SidebarDemoItem } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function Sidebar() {
  const { t, lang } = useT();
  const { theme } = useTheme();
  const pathname = usePathname();

  const demos = useMemo(() => buildSidebarDemos(t), [t, lang]);

  // El logo varía con el tema: el "on-dark" es para el background oscuro
  // (dark mode usa una superficie navy, ahí el mark white-on-mint funciona).
  const logoSrc =
    theme === 'dark' ? '/brand/logo-mark-on-dark.svg' : '/brand/logo-mark.svg';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image
          src={logoSrc}
          width={32}
          height={32}
          alt=""
          aria-hidden
          priority
          style={{ display: 'block' }}
        />
        <div>
          <div className="sidebar-brand-name">AI Demo Platform</div>
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
