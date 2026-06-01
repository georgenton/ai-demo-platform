// -----------------------------------------------------------------------------
// Landing `/` — dashboard del tenant.
//
// Cambio respecto al pre-multitenant (PR-MT5):
//   Antes la landing redirigía siempre a /demo/rag (asunción: cualquier
//   visitante tiene rag). Con multi-tenant eso ya no aplica — un tenant
//   "banca" no tiene tutor, un tenant "salud" no tiene comparator, etc.
//
//   Ahora la landing renderiza un dashboard simple con las cards de demos
//   habilitados para el tenant del usuario logueado. El usuario elige
//   cuál abrir.
//
// STUB FUNCIONAL: layout mínimo con tokens del ui-kit + strings i18n.
// El polishing visual (hero, cards con thumbnails, animaciones) va a
// Claude Design en un PR siguiente — el contrato (useMyDemos → grid)
// ya queda fijado.
// -----------------------------------------------------------------------------

'use client';

import Link from 'next/link';

import { useAuth, useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { MeDemo } from '@/lib/api/types-auth';

export default function DashboardPage() {
  const { t } = useT();
  const auth = useAuth();
  const { status, data } = useMyDemos();

  // El AuthProvider + middleware ya garantizan que si llegamos acá hay
  // sesión authenticated o estamos en transición. Mostramos placeholder
  // durante loading inicial para evitar flashes.
  if (auth.status === 'loading' || status === 'loading' || status === 'idle') {
    return <DashboardPlaceholder message={t('dashboard.loading')} />;
  }

  if (status === 'error' || !data) {
    return <DashboardPlaceholder message={t('dashboard.error')} />;
  }

  if (data.demos.length === 0) {
    return <EmptyDashboard />;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding:
          'var(--spacing-8, 32px) var(--spacing-6, 24px) var(--spacing-6, 24px)',
        background: 'var(--surface-bg, #0c1418)',
      }}
    >
      <header
        style={{ maxWidth: 1120, margin: '0 auto var(--spacing-6, 24px)' }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-2xl, 24px)',
            color: 'var(--text-strong, #f0f5f8)',
            margin: 0,
            fontWeight: 600,
          }}
        >
          {t('dashboard.welcome', {
            name: auth.user?.displayName ?? auth.user?.email ?? '',
          })}
        </h1>
        <p
          style={{
            marginTop: 6,
            color: 'var(--text-muted, #87969f)',
            fontSize: 'var(--font-size-sm, 13px)',
          }}
        >
          {t('dashboard.subtitle', {
            tenantName: data.tenant.displayName,
            industryName: data.industry.displayName,
          })}
        </p>
      </header>

      <ul
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-4, 16px)',
          listStyle: 'none',
          padding: 0,
        }}
      >
        {data.demos.map((demo) => (
          <li key={demo.id}>
            <DemoCard demo={demo} openLabel={t('dashboard.openDemo')} />
          </li>
        ))}
      </ul>
    </main>
  );
}

function DemoCard({ demo, openLabel }: { demo: MeDemo; openLabel: string }) {
  return (
    <Link
      href={demo.route}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--spacing-5, 20px)',
        background: 'var(--surface-card, #131e23)',
        border: '1px solid var(--border-default, #1f2c33)',
        borderRadius: 'var(--radius-lg, 12px)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--font-size-lg, 16px)',
          fontWeight: 600,
          color: 'var(--text-strong, #f0f5f8)',
        }}
      >
        {demo.title}
      </h2>
      <p
        style={{
          marginTop: 6,
          marginBottom: 0,
          fontSize: 'var(--font-size-sm, 13px)',
          color: 'var(--text-default, #c5d1d8)',
          fontStyle: 'italic',
        }}
      >
        {demo.tagline}
      </p>
      <p
        style={{
          marginTop: 'var(--spacing-3, 12px)',
          marginBottom: 0,
          fontSize: 'var(--font-size-sm, 13px)',
          color: 'var(--text-muted, #87969f)',
          flex: 1,
        }}
      >
        {demo.description}
      </p>
      <span
        style={{
          marginTop: 'var(--spacing-4, 16px)',
          fontSize: 'var(--font-size-sm, 13px)',
          color: 'var(--accent-default, #43c194)',
          fontWeight: 600,
        }}
      >
        {openLabel} →
      </span>
    </Link>
  );
}

function DashboardPlaceholder({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-bg, #0c1418)',
        color: 'var(--text-muted, #87969f)',
        fontSize: 'var(--font-size-sm, 13px)',
      }}
    >
      {message}
    </main>
  );
}

function EmptyDashboard() {
  const { t } = useT();
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-bg, #0c1418)',
        padding: 'var(--spacing-6, 24px)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: 'center',
          color: 'var(--text-default, #c5d1d8)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-size-xl, 20px)',
            color: 'var(--text-strong, #f0f5f8)',
          }}
        >
          {t('dashboard.empty.title')}
        </h1>
        <p style={{ marginTop: 12, fontSize: 'var(--font-size-sm, 13px)' }}>
          {t('dashboard.empty.body')}
        </p>
      </div>
    </main>
  );
}
