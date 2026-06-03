// -----------------------------------------------------------------------------
// Sidebar — navegación principal a la izquierda.
//
// Refactor del refinamiento multi-tenant (mockup 04-sidebar.html). Resuelve
// tres problemas concretos del stub anterior:
//
//   1. Lockup adaptativo según presencia de logo del tenant:
//      - CON branding.logoUrl: el logo del tenant es protagonista arriba +
//        "Powered by NAI" en el footer del sidebar.
//      - SIN logoUrl: lockup NAI default (logo NAI + nombre tenant), pero el
//        logo NAI más sutil para no competir con el nombre.
//
//   2. Truncate de nombres largos a 2 líneas con elipsis + tooltip (title=)
//      con el nombre completo. Antes los nombres largos rompían el layout.
//
//   3. Guarda de contraste WCAG estricta theme-aware: si el accentColor del
//      tenant no pasa AA non-text (3:1) contra el fondo del sidebar en
//      AMBOS temas (light Y dark), cae al fallback mint-600 (#2E9A72).
//      Documentado en lib/branding/contrast.ts. El admin recibe una
//      advertencia inline en /admin/tenant cuando elige un color que falla.
//
// El filtro de demos por enabledDemos del tenant ya estaba — se mantiene.
// El listado optimistic (mostrar el catálogo completo mientras meDemos
// carga) también se mantiene para evitar flash de sidebar vacío.
// -----------------------------------------------------------------------------

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { Icon } from '@/components/ui';
import { resolveAccentStrict } from '@/lib/branding/contrast';
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
  // El Sidebar vive bajo (shell)/layout, ya autenticado (middleware redirige).
  // useMyDemos devuelve idle/null mientras hidrata.
  const { data: meDemos } = useMyDemos();

  // Filtramos el catálogo a los demos habilitados para el tenant. Si meDemos
  // todavía no cargó, mostramos el catálogo completo (optimistic display).
  const allDemos = useMemo(() => buildSidebarDemos(t), [t, lang]);
  const demos = useMemo(() => {
    if (!meDemos) return allDemos;
    const enabled = new Set(meDemos.demos.map((d) => d.id));
    return allDemos.filter((d) => enabled.has(d.id));
  }, [allDemos, meDemos]);

  // Branding: nombre, color de acento, logo.
  const branding = readBranding(meDemos?.tenant.branding);
  const displayName =
    branding.displayName ?? meDemos?.tenant.displayName ?? 'AI Demo Platform';
  const hasTenantLogo = !!branding.logoUrl;

  // Guarda de contraste estricta theme-aware. Si el accentColor del tenant
  // falla AA non-text (3:1) contra el fondo del sidebar en AMBOS temas, cae
  // al fallback mint-600. Es la misma decisión en light y dark — branding
  // predecible y consistente. Si el tenant no tiene accent custom, también
  // devuelve el fallback (color de la marca).
  const resolvedAccent = resolveAccentStrict(branding.accentColor);

  // El logo del kit varía con el tema; si el tenant trae un logoUrl
  // custom, lo usamos en ambos temas (es responsabilidad del admin elegir
  // un logo que se vea bien en dark/light).
  const defaultLogo =
    theme === 'dark' ? '/brand/logo-mark-on-dark.svg' : '/brand/logo-mark.svg';

  // Inyectamos el accent resuelto como CSS var inline. Cualquier elemento
  // del sidebar que use --color-accent (rail del item activo, badges, focus
  // rings) lo hereda. El resto de la app NO se ve afectado.
  const accentOverride = {
    ['--color-accent']: resolvedAccent,
  } as React.CSSProperties;

  return (
    <aside className="sidebar" style={accentOverride}>
      {/* Brand lockup adaptativo según presencia de logo del tenant */}
      {hasTenantLogo ? (
        <TenantLockup logoUrl={branding.logoUrl as string} alt={displayName} />
      ) : (
        <DefaultLockup
          logoSrc={defaultLogo}
          displayName={displayName}
          tagline={t('shell.brand.tag')}
        />
      )}

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

      {/* Footer "Powered by NAI" — solo si el tenant trae su propio logo,
          así el usuario reconoce quién provee la plataforma. */}
      {hasTenantLogo && <PoweredByFoot defaultLogoSrc={defaultLogo} />}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Brand lockups
// ---------------------------------------------------------------------------

/**
 * Lockup default (sin logo del tenant): logo NAI + nombre del tenant +
 * tagline. El logo NAI queda más sutil que el nombre del tenant para no
 * competir visualmente.
 */
function DefaultLockup({
  logoSrc,
  displayName,
  tagline,
}: {
  logoSrc: string;
  displayName: string;
  tagline: string;
}) {
  return (
    <div className="sidebar-brand sidebar-brand--default">
      <Image
        className="sidebar-brand-mark"
        src={logoSrc}
        width={30}
        height={30}
        alt=""
        aria-hidden
        priority
      />
      <div className="sidebar-brand-text">
        <div className="sidebar-brand-name" title={displayName}>
          {displayName}
        </div>
        <div className="sidebar-brand-tag">{tagline}</div>
      </div>
    </div>
  );
}

/**
 * Lockup con logo del tenant protagonista. NAI baja al footer "Powered by".
 * El logo se renderiza con unoptimized porque viene de un dominio arbitrario
 * (CDN del cliente) y no queremos que Next intente procesarlo.
 */
function TenantLockup({ logoUrl, alt }: { logoUrl: string; alt: string }) {
  return (
    <div className="sidebar-brand sidebar-brand--tenant">
      <Image
        className="tenant-logo"
        src={logoUrl}
        width={132}
        height={40}
        alt={alt}
        unoptimized
        priority
      />
    </div>
  );
}

/**
 * Footer "Powered by NAI" — solo aparece cuando el tenant tiene su propio
 * logo arriba. Cierra la información de quién provee la plataforma sin
 * competir con la marca del tenant.
 */
function PoweredByFoot({ defaultLogoSrc }: { defaultLogoSrc: string }) {
  const { t } = useT();
  return (
    <div className="sidebar-foot">
      <Image src={defaultLogoSrc} width={18} height={18} alt="" aria-hidden />
      <div className="pb">
        <span className="pb-label">{t('shell.brand.poweredBy')}</span>
        <span className="pb-tag">{t('shell.brand.tag')}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo item
// ---------------------------------------------------------------------------

interface DemoItemProps {
  demo: SidebarDemoItem;
  active: boolean;
  comingLabel: string;
}

function DemoItem({ demo, active, comingLabel }: DemoItemProps) {
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

// ---------------------------------------------------------------------------
// Service status (health dot)
// ---------------------------------------------------------------------------

/**
 * "Servicio activo" — dot pulsante + texto al pie del sidebar. Hoy es
 * estático. Cuando se quiera hacerlo "vivo" se conecta a `GET /api/v1/health`
 * con polling 30s y se cambia la clase del dot a `warn` o `danger` según la
 * respuesta. Las clases están definidas en ui-kit.css (`.health-dot.warn` /
 * `.health-dot.danger`).
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
