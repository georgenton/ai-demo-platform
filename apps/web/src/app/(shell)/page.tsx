// -----------------------------------------------------------------------------
// Landing `/` — dashboard del tenant.
//
// Implementación final basada en el mockup 03-dashboard.html del paquete
// multitenant_refinement. Cuatro estados visibles:
//
//   1. Loading → skeletons con shimmer (no texto plano).
//   2. Error   → state-block con mensaje + CTA "Reintentar" (refresh()).
//   3. Empty   → state-block "no hay demos habilitados".
//   4. Normal  → grilla de demo-cards con identidad por demo.
//
// Identidad visual por demo:
//   El catálogo del backend NO sabe de iconos ni colores — eso es decisión
//   del frontend. Los iconos están en `lib/catalog/demos.ts`, los colores
//   en `ui-kit.css` como `--demo-accent-*`. La card lee el accent del
//   atributo `data-demo` y el icono del mapeo.
//
// Indicador "Cartelera personalizada":
//   Solo si `data.overridden === true`. Le avisa al admin que está viendo
//   una lista custom y no la default de su industry (regla de ADR-0013).
// -----------------------------------------------------------------------------

'use client';

import Link from 'next/link';

import { Badge, Icon } from '@/components/ui';
import { DEMOS_CATALOG } from '@/lib/catalog/demos';
import { useAuth, useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { MeDemo } from '@/lib/api/types-auth';

/**
 * Mapeo del id del demo al icono Lucide a usar. La fuente real es el catálogo
 * del frontend (`DEMOS_CATALOG`). Esto solo es un lookup O(1) para evitar
 * iterar el array en cada card.
 */
const DEMO_ICON: Record<string, string> = Object.fromEntries(
  DEMOS_CATALOG.map((d) => [d.id, d.icon]),
);

/** Icono fallback si llega un demoId desconocido (no debería pasar). */
const FALLBACK_ICON = 'layout-grid';

export default function DashboardPage() {
  const { t } = useT();
  const auth = useAuth();
  const { status, data, refresh } = useMyDemos();

  // El AuthProvider + middleware ya garantizan que si llegamos acá hay
  // sesión authenticated o estamos en transición. Mostramos loading
  // mientras el provider y/o useMyDemos terminan de hidratar.
  const isLoading =
    auth.status === 'loading' || status === 'loading' || status === 'idle';

  if (isLoading) {
    return (
      <main className="dashboard-page">
        <DashboardHead loading />
        <DashboardSkeletons count={5} />
      </main>
    );
  }

  if (status === 'error' || !data) {
    return (
      <main className="dashboard-page">
        <DashboardHead error />
        <ErrorState onRetry={() => void refresh()} />
      </main>
    );
  }

  if (data.demos.length === 0) {
    return (
      <main className="dashboard-page">
        <DashboardHead
          welcomeName={auth.user?.displayName ?? auth.user?.email ?? ''}
          tenantName={data.tenant.displayName}
          industryName={data.industry.displayName}
          role={auth.user?.role}
        />
        <EmptyState />
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <DashboardHead
        welcomeName={auth.user?.displayName ?? auth.user?.email ?? ''}
        tenantName={data.tenant.displayName}
        industryName={data.industry.displayName}
        role={auth.user?.role}
      />

      <div className="dashboard-section-label">
        <span>{t('dashboard.section.demos')}</span>
        {data.overridden && (
          <Badge tone="info" mono={false}>
            <Icon name="sparkles" size={11} className="ic" />
            <span style={{ marginLeft: 4 }}>
              {t('dashboard.overridden.badge')}
            </span>
          </Badge>
        )}
      </div>

      <ul
        className="dashboard-grid"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {data.demos.map((demo) => (
          <li key={demo.id}>
            <DemoCard demo={demo} />
          </li>
        ))}
      </ul>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

interface DashboardHeadProps {
  welcomeName?: string;
  tenantName?: string;
  industryName?: string;
  role?: 'member' | 'admin' | 'superadmin';
  loading?: boolean;
  error?: boolean;
}

function DashboardHead({
  welcomeName,
  tenantName,
  industryName,
  role,
  loading,
  error,
}: DashboardHeadProps) {
  const { t } = useT();

  if (loading) {
    return (
      <header className="dashboard-head">
        <div className="dashboard-welcome-row">
          <div
            className="skeleton skel-line"
            style={{ width: 220, height: 30 }}
          />
        </div>
        <p className="sub">{t('dashboard.loading')}</p>
      </header>
    );
  }

  if (error) {
    return (
      <header className="dashboard-head">
        <h1>{t('dashboard.error.title')}</h1>
      </header>
    );
  }

  const isAdmin = role === 'admin' || role === 'superadmin';
  return (
    <header className="dashboard-head">
      <div className="dashboard-welcome-row">
        <h1>{t('dashboard.welcome', { name: welcomeName ?? '' })}</h1>
        {isAdmin && <Badge tone="success">{t('header.user.role.admin')}</Badge>}
      </div>
      <p className="sub">
        {t('dashboard.subtitle', {
          tenantName: tenantName ?? '',
          industryName: industryName ?? '',
        })}
      </p>
    </header>
  );
}

function DemoCard({ demo }: { demo: MeDemo }) {
  const { t } = useT();
  const icon = DEMO_ICON[demo.id] ?? FALLBACK_ICON;
  const isComing = demo.status === 'coming-soon';

  const inner = (
    <>
      <span className="demo-card-icon">
        <Icon name={icon} className="ic" />
      </span>
      <div className="demo-card-title">{demo.title}</div>
      <div className="demo-card-tagline">{demo.tagline}</div>
      <p className="demo-card-desc">{demo.description}</p>
      <div className="audience-row" style={{ marginTop: 14 }}>
        {demo.audience.map((chip, i) => (
          <span key={i} className="audience-chip">
            {chip}
          </span>
        ))}
      </div>
      <div className="demo-card-foot">
        {isComing ? (
          <Badge tone="warn">
            <Icon name="clock" size={12} className="ic" />
            <span style={{ marginLeft: 4 }}>
              {t('dashboard.card.comingSoon')}
            </span>
          </Badge>
        ) : (
          <span className="demo-card-open">
            {t('dashboard.openDemo')}
            <Icon name="arrow-right" className="ic" />
          </span>
        )}
      </div>
    </>
  );

  // Las coming-soon NO son links — se renderizan como div para que el
  // cursor no engañe al usuario.
  if (isComing) {
    return (
      <div className="demo-card is-coming" data-demo={demo.id}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={demo.route} className="demo-card" data-demo={demo.id}>
      {inner}
    </Link>
  );
}

function DashboardSkeletons({ count }: { count: number }) {
  return (
    <ul
      className="dashboard-grid"
      style={{ listStyle: 'none', padding: 0, margin: 0 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}

function SkeletonCard() {
  return (
    <div className="demo-card-skel">
      <div
        className="skeleton"
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}
      />
      <div
        className="skeleton skel-line"
        style={{ width: '60%', marginBottom: 8 }}
      />
      <div
        className="skeleton skel-line"
        style={{ width: '40%', height: 10, marginBottom: 14 }}
      />
      <div
        className="skeleton skel-line"
        style={{ width: '100%', height: 10, marginBottom: 6 }}
      />
      <div
        className="skeleton skel-line"
        style={{ width: '85%', height: 10 }}
      />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <div className="state-block">
      <span className="state-icon">
        <Icon name="cloud-off" className="ic" />
      </span>
      <h3>{t('dashboard.error.title')}</h3>
      <p>{t('dashboard.error')}</p>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        <Icon name="rotate-cw" className="ic" />
        <span style={{ marginLeft: 6 }}>{t('dashboard.error.retry')}</span>
      </button>
    </div>
  );
}

function EmptyState() {
  const { t } = useT();
  return (
    <div className="state-block">
      <span className="state-icon">
        <Icon name="layout-grid" className="ic" />
      </span>
      <h3>{t('dashboard.empty.title')}</h3>
      <p>{t('dashboard.empty.body')}</p>
    </div>
  );
}
