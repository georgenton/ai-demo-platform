// -----------------------------------------------------------------------------
// /admin/tenant — administración del tenant.
//
// Implementación final basada en el mockup 05-admin-tenant.html del paquete
// multitenant_refinement. Estructura de dos columnas:
//
//   ┌────────────────────────┬──────────────┐
//   │  Form (3 secciones)    │  Preview     │
//   │  · General             │  en vivo     │
//   │  · Demos               │  del sidebar │
//   │  · Branding            │  (sticky)    │
//   └────────────────────────┴──────────────┘
//
// Las tres secciones son cards apiladas (NO tabs) — el admin ve el contexto
// completo de un vistazo. El preview del sidebar se actualiza en vivo
// mientras edita branding (sin esperar al save).
//
// Estados del flujo de save: edit → saving → saved (banner verde) | err403 |
// err400 (con detalle del backend) | err generic. El backend mergea el
// branding NO destructivo (PATCH).
//
// Color picker: swatches curados (todos pasan la guarda estricta) + color
// nativo del browser para casos custom. La validación inline de contraste
// usa evaluateAccent() — si falla, advertencia clara nombrando el tema
// problemático, y la guarda real igual cae al fallback (en backend + frontend
// del sidebar).
//
// Guarda visual de acceso: si el rol es member, mostramos el state-block
// "sin permisos" en lugar del form. El backend igual rechaza con 403
// (RolesGuard) — esto es UX.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge, Icon } from '@/components/ui';
import { updateMyTenant } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { evaluateAccent } from '@/lib/branding/contrast';
import { DEMOS_CATALOG } from '@/lib/catalog/demos';
import { useAuth, useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';
import { LiveSidebarPreview } from './LiveSidebarPreview';

/**
 * Swatches curados: TODOS pasan la guarda estricta (3:1 non-text en ambos
 * temas). El primero es mint-600 (la marca del producto); el resto son
 * tonos medios que funcionan en claro y oscuro. El input nativo deja
 * elegir cualquier color — ahí la guarda muestra advertencia si no pasa.
 */
const SWATCHES = ['#2E9A72', '#2A6FDB', '#C2410C', '#7B5BD6', '#D23456'];

/** Mapa demoId → icono Lucide. Reusado del catálogo. */
const DEMO_ICON: Record<string, string> = Object.fromEntries(
  DEMOS_CATALOG.map((d) => [d.id, d.icon]),
);

interface FormState {
  displayName: string;
  enabledDemoIds: Set<string>;
  accentColor: string;
  logoUrl: string;
  brandingDisplayName: string;
}

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; messageKey: StringKey; detail?: string };

export default function AdminTenantPage() {
  const { t } = useT();
  const auth = useAuth();
  const { data: meDemos, status: meStatus, refresh } = useMyDemos();

  const [form, setForm] = useState<FormState>({
    displayName: '',
    enabledDemoIds: new Set(),
    accentColor: '',
    logoUrl: '',
    brandingDisplayName: '',
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });

  // Hidratación inicial del form cuando llegan los datos del tenant.
  useEffect(() => {
    if (meStatus !== 'ready' || !meDemos) return;
    const branding =
      meDemos.tenant.branding && typeof meDemos.tenant.branding === 'object'
        ? (meDemos.tenant.branding as Record<string, unknown>)
        : {};
    setForm({
      displayName: meDemos.tenant.displayName,
      enabledDemoIds: new Set(meDemos.demos.map((d) => d.id)),
      accentColor:
        typeof branding.accentColor === 'string' ? branding.accentColor : '',
      logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : '',
      brandingDisplayName:
        typeof branding.displayName === 'string' ? branding.displayName : '',
    });
  }, [meStatus, meDemos]);

  // Evaluación de contraste del accent elegido. Útil para mostrar la
  // advertencia inline (theme-aware: nombra cuál tema falla).
  const contrastEval = useMemo(() => {
    if (!form.accentColor) return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(form.accentColor)) return null;
    return evaluateAccent(form.accentColor);
  }, [form.accentColor]);

  // UX guard — el form solo se muestra a admin/superadmin. Backend igual
  // rechaza con 403 si llega de otro modo.
  const isAdmin =
    auth.user?.role === 'admin' || auth.user?.role === 'superadmin';

  const handleToggleDemo = useCallback((id: string) => {
    setForm((prev) => {
      const next = new Set(prev.enabledDemoIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, enabledDemoIds: next };
    });
  }, []);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaveStatus({ kind: 'saving' });
      try {
        await updateMyTenant({
          displayName: form.displayName.trim() || undefined,
          enabledDemos: Array.from(form.enabledDemoIds),
          branding: {
            accentColor: form.accentColor || undefined,
            logoUrl: form.logoUrl || undefined,
            displayName: form.brandingDisplayName || undefined,
          },
        });
        setSaveStatus({ kind: 'saved' });
        // Refresh sin reload — el sidebar + dashboard reflejan los cambios.
        await refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setSaveStatus({
              kind: 'error',
              messageKey: 'admin.error.forbidden',
            });
            return;
          }
          if (err.status === 400) {
            // El mensaje del backend suele ser específico (ej. "enabledDemos
            // contiene IDs inválidos: tutor_v2"). Lo mostramos tal cual.
            setSaveStatus({
              kind: 'error',
              messageKey: 'admin.error.generic',
              detail: err.message,
            });
            return;
          }
        }
        setSaveStatus({ kind: 'error', messageKey: 'admin.error.generic' });
      }
    },
    [form, refresh],
  );

  // Estado loading inicial del meDemos — placeholder neutro.
  if (meStatus === 'idle' || meStatus === 'loading') {
    return (
      <main className="admin-page">
        <AdminHeader />
        <p style={{ color: 'var(--color-fg-muted)' }}>
          {t('dashboard.loading')}
        </p>
      </main>
    );
  }

  if (!meDemos) {
    return (
      <main className="admin-page">
        <AdminHeader />
        <NoPermissionState message={t('admin.error.generic')} />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <AdminHeader />
        <NoPermissionState message={t('admin.error.forbidden')} />
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminHeader />

      <div className="admin-layout">
        <form className="admin-form" onSubmit={handleSave}>
          {/* Sección 1 — General */}
          <section className="admin-section">
            <div className="admin-section-head">
              <Icon name="building-2" className="ic" />
              <div>
                <div className="t">{t('admin.section.general')}</div>
                <div className="d">{t('admin.section.general.hint')}</div>
              </div>
            </div>
            <div className="admin-section-body">
              <div className="field">
                <label className="field-label" htmlFor="tname">
                  {t('admin.displayName.label')}
                </label>
                <input
                  id="tname"
                  className="input"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, displayName: e.target.value }))
                  }
                  maxLength={200}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">
                  {t('admin.industry.label')}
                </label>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 13,
                    color: 'var(--color-fg-muted)',
                    background: 'var(--color-bg-sunken)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    width: 'fit-content',
                  }}
                >
                  <Icon name="lock" size={14} />
                  {meDemos.industry.displayName}
                  <span
                    style={{
                      color: 'var(--color-fg-subtle)',
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    · {t('admin.industry.readonly')}
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* Sección 2 — Demos */}
          <section className="admin-section">
            <div className="admin-section-head">
              <Icon name="layout-grid" className="ic" />
              <div>
                <div className="t">{t('admin.enabledDemos.label')}</div>
                <div className="d">
                  {form.enabledDemoIds.size} {' / '} {meDemos.demos.length}
                </div>
              </div>
            </div>
            <div className="admin-section-body">
              {/* La nota "Heredado de tu industria" aparece cuando NO hay
                  override (la lista del tenant es vacía y se hereda de la
                  industry). Lo derivamos de meDemos.overridden. */}
              {!meDemos.overridden && (
                <div className="inherited-note">
                  <Icon name="git-branch" className="ic" />
                  {t('admin.enabledDemos.inherited', {
                    industry: meDemos.industry.displayName,
                  })}
                </div>
              )}
              {meDemos.demos.map((demo) => (
                <label
                  key={demo.id}
                  className="demo-toggle"
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={form.enabledDemoIds.has(demo.id)}
                    onChange={() => handleToggleDemo(demo.id)}
                  />
                  <div className="body">
                    <div className="t">{demo.title}</div>
                    <div className="d">{demo.tagline}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Sección 3 — Branding */}
          <section className="admin-section">
            <div className="admin-section-head">
              <Icon name="palette" className="ic" />
              <div>
                <div className="t">{t('admin.section.branding')}</div>
                <div className="d">{t('admin.preview.refreshNote')}</div>
              </div>
            </div>
            <div className="admin-section-body">
              {/* Color de acento — swatches curados + input nativo del browser */}
              <div className="field">
                <label className="field-label">
                  {t('admin.branding.accentColor')}
                </label>
                <div className="color-control">
                  <div className="color-swatches">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={[
                          'color-swatch',
                          form.accentColor.toLowerCase() === c.toLowerCase() &&
                            'selected',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ background: c }}
                        aria-label={c}
                        onClick={() =>
                          setForm((p) => ({ ...p, accentColor: c }))
                        }
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    className="color-native"
                    value={form.accentColor || '#2E9A72'}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, accentColor: e.target.value }))
                    }
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--color-fg-muted)',
                    }}
                  >
                    {form.accentColor.toUpperCase() || '—'}
                  </span>
                </div>
                {/* Advertencia inline si el accent no pasa la guarda
                    estricta. Nombra el tema problemático y explica que
                    igual aplicaremos el fallback. */}
                {contrastEval && !contrastEval.ok && (
                  <div
                    className="contrast-warning"
                    role="status"
                    style={{ marginTop: 8 }}
                  >
                    <Icon name="alert-triangle" className="ic" />
                    <span>
                      {t('admin.branding.contrast.warning', {
                        theme:
                          contrastEval.failing === 'dark'
                            ? t('admin.branding.contrast.theme.dark')
                            : t('admin.branding.contrast.theme.light'),
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* URL del logo del tenant + preview */}
              <div className="field">
                <label className="field-label" htmlFor="logoUrl">
                  {t('admin.branding.logoUrl')}
                </label>
                <div
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
                >
                  <input
                    id="logoUrl"
                    className="input"
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, logoUrl: e.target.value }))
                    }
                    placeholder="https://cdn.tu-dominio.com/logo.svg"
                  />
                  <span className="logo-preview">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt=""
                        onError={(e) => {
                          // Si la URL no carga, fallback al placeholder ícono.
                          (e.currentTarget as HTMLImageElement).style.display =
                            'none';
                        }}
                      />
                    ) : (
                      <Icon name="image" size={18} className="ic ph" />
                    )}
                  </span>
                </div>
                <span className="field-hint">
                  {t('admin.branding.logoUrl.hint')}
                </span>
              </div>

              {/* Nombre mostrado en el sidebar */}
              <div className="field">
                <label className="field-label" htmlFor="brandingName">
                  {t('admin.branding.displayName')}
                </label>
                <input
                  id="brandingName"
                  className="input"
                  value={form.brandingDisplayName}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      brandingDisplayName: e.target.value,
                    }))
                  }
                  maxLength={120}
                />
              </div>
            </div>
          </section>

          {/* Banner de error/saved */}
          {saveStatus.kind === 'error' && (
            <div className="field-error" role="alert">
              <Icon
                name={
                  saveStatus.messageKey === 'admin.error.forbidden'
                    ? 'shield-x'
                    : 'alert-circle'
                }
                className="ic"
              />
              <span>
                {t(saveStatus.messageKey)}
                {saveStatus.detail && (
                  <>
                    {' '}
                    <span style={{ opacity: 0.85 }}>{saveStatus.detail}</span>
                  </>
                )}
              </span>
            </div>
          )}
          {saveStatus.kind === 'saved' && (
            <div className="save-banner" role="status">
              <Icon name="check-circle-2" className="ic" />
              <span>{t('admin.saved')}</span>
            </div>
          )}

          <div className="admin-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saveStatus.kind === 'saving'}
            >
              {saveStatus.kind === 'saving'
                ? t('admin.saving')
                : t('admin.save')}
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-fg-subtle)' }}>
              {t('admin.preview.refreshNote')}
            </span>
          </div>
        </form>

        {/* Preview en vivo del sidebar */}
        <aside className="admin-preview">
          <div className="admin-preview-label">
            {t('admin.branding.preview')}
          </div>
          <div className="preview-frame">
            <div style={{ padding: 12 }}>
              <LiveSidebarPreview
                tenantDisplayName={
                  form.brandingDisplayName ||
                  form.displayName ||
                  meDemos.tenant.displayName
                }
                accentColor={form.accentColor}
                logoUrl={form.logoUrl}
                demos={meDemos.demos
                  .filter((d) => form.enabledDemoIds.has(d.id))
                  .map((d) => ({
                    id: d.id,
                    title: d.title,
                    icon: DEMO_ICON[d.id] ?? 'layout-grid',
                  }))}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function AdminHeader() {
  const { t } = useT();
  return (
    <header style={{ marginBottom: 24 }}>
      <div className="page-title-eyebrow">{t('admin.title')}</div>
      <h1 className="page-title" style={{ fontSize: 'var(--text-3xl)' }}>
        {t('admin.title')}
      </h1>
      <p className="page-subtitle">{t('admin.subtitle')}</p>
    </header>
  );
}

function NoPermissionState({ message }: { message: string }) {
  return (
    <div className="state-block" style={{ maxWidth: 560, margin: '0 auto' }}>
      <span className="state-icon">
        <Icon name="shield-x" className="ic" />
      </span>
      <h3>{message}</h3>
    </div>
  );
}

// Tipo no usado externamente, evita warning ESLint si se importa.
export type { FormState, SaveStatus };
// Badge se importa para asegurar que se tipa correcto si el dev futuro suma badges.
void Badge;
