// -----------------------------------------------------------------------------
// /admin/tenant — admin panel para editar el tenant.
//
// STUB FUNCIONAL (PR-MT5):
//   Form completamente operativo (PATCH /admin/tenant), UI minimal con
//   tokens del ui-kit. El polishing visual (sidebar dedicado al admin,
//   tabs, color picker, preview en vivo) va a Claude Design en un PR
//   siguiente — el contrato (form fields, useMyDemos, updateMyTenant)
//   ya está fijado.
//
// Guard de cliente:
//   El RolesGuard del backend rechaza con 403 si el rol no es admin. La
//   UI también esconde el form si auth.user.role === 'member'. Es UX,
//   no seguridad — la seguridad real está en el backend.
//
// Lista de demos: la sacamos del catálogo del backend via useMyDemos
// (`data.demos` solo trae los habilitados; necesitamos TODOS para que el
// admin pueda marcar/desmarcar). Para eso fetchamos GET /api/v1/demos —
// que en PR-MT3 también filtra por tenant, así el admin solo ve demos a
// los que su tenant podría acceder. Si necesitamos mostrar literalmente
// todos los demos posibles (incluyendo los que el tenant no tiene), el
// backend tendría que exponer un endpoint admin-only con el catálogo
// crudo. Por ahora trabajamos con los enabled actuales + dejamos el
// admin desmarcar.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { updateMyTenant } from '@/lib/api/admin';
import { useAuth, useMyDemos } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';

export default function AdminTenantPage() {
  const { t } = useT();
  const auth = useAuth();
  const { data: meDemos, status: meStatus, refresh } = useMyDemos();

  // Estados del form. Inicializamos desde meDemos cuando esté listo.
  const [displayName, setDisplayName] = useState('');
  const [enabledDemoIds, setEnabledDemoIds] = useState<Set<string>>(new Set());
  const [accentColor, setAccentColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandingDisplayName, setBrandingDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<StringKey | null>(null);
  const [errorKey, setErrorKey] = useState<StringKey | null>(null);

  // Hidratación inicial del form cuando llegan los datos.
  useEffect(() => {
    if (meStatus !== 'ready' || !meDemos) return;
    setDisplayName(meDemos.tenant.displayName);
    setEnabledDemoIds(new Set(meDemos.demos.map((d) => d.id)));
    const branding =
      meDemos.tenant.branding && typeof meDemos.tenant.branding === 'object'
        ? (meDemos.tenant.branding as Record<string, unknown>)
        : {};
    setAccentColor(
      typeof branding.accentColor === 'string' ? branding.accentColor : '',
    );
    setLogoUrl(typeof branding.logoUrl === 'string' ? branding.logoUrl : '');
    setBrandingDisplayName(
      typeof branding.displayName === 'string' ? branding.displayName : '',
    );
  }, [meStatus, meDemos]);

  // UX guard — esconde el form si el rol es member. Backend igual rechaza.
  const isAdmin =
    auth.user?.role === 'admin' || auth.user?.role === 'superadmin';

  const handleToggleDemo = (id: string) => {
    setEnabledDemoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedKey(null);
    setErrorKey(null);
    setSaving(true);

    // Construimos solo los campos que cambiaron — comparación shallow contra
    // los originales del meDemos. Mantenerlo simple: enviamos siempre todo
    // el "block" del branding aunque no haya cambiado, el backend lo mergea.
    try {
      await updateMyTenant({
        displayName: displayName.trim() || undefined,
        enabledDemos: Array.from(enabledDemoIds),
        branding: {
          accentColor: accentColor || undefined,
          logoUrl: logoUrl || undefined,
          displayName: brandingDisplayName || undefined,
        },
      });
      setSavedKey('admin.saved');
      // Refrescamos useMyDemos para que el sidebar y el resto del shell
      // refleje los cambios sin reload.
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setErrorKey('admin.error.forbidden');
      } else {
        setErrorKey('admin.error.generic');
      }
    } finally {
      setSaving(false);
    }
  };

  // Estado de carga inicial del meDemos.
  if (meStatus === 'idle' || meStatus === 'loading') {
    return <PanelPlaceholder message={t('dashboard.loading')} />;
  }
  if (!meDemos) {
    return <PanelPlaceholder message={t('dashboard.error')} />;
  }
  if (!isAdmin) {
    return <PanelPlaceholder message={t('admin.error.forbidden')} />;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'var(--spacing-8, 32px) var(--spacing-6, 24px)',
        background: 'var(--surface-bg, #0c1418)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 'var(--spacing-6, 24px)' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-size-2xl, 24px)',
              color: 'var(--text-strong, #f0f5f8)',
              fontWeight: 600,
            }}
          >
            {t('admin.title')}
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--text-muted, #87969f)',
            }}
          >
            {t('admin.subtitle')}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-5, 20px)',
            padding: 'var(--spacing-6, 24px)',
            background: 'var(--surface-card, #131e23)',
            border: '1px solid var(--border-default, #1f2c33)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          <FormField label={t('admin.displayName.label')}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={1}
              maxLength={200}
              style={inputStyle}
            />
          </FormField>

          <FormField
            label={t('admin.enabledDemos.label')}
            hint={t('admin.enabledDemos.hint', {
              industry: meDemos.industry.displayName,
            })}
          >
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {meDemos.demos.map((demo) => (
                <label
                  key={demo.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm, 13px)',
                    color: 'var(--text-default, #c5d1d8)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabledDemoIds.has(demo.id)}
                    onChange={() => handleToggleDemo(demo.id)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-strong, #f0f5f8)',
                      }}
                    >
                      {demo.title}
                    </div>
                    <div style={{ color: 'var(--text-muted, #87969f)' }}>
                      {demo.tagline}
                    </div>
                  </div>
                </label>
              ))}
            </fieldset>
          </FormField>

          <fieldset
            style={{
              border: '1px solid var(--border-default, #1f2c33)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: 'var(--spacing-4, 16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-3, 12px)',
            }}
          >
            <legend
              style={{
                padding: '0 8px',
                fontSize: 'var(--font-size-sm, 13px)',
                color: 'var(--text-default, #c5d1d8)',
                fontWeight: 600,
              }}
            >
              {t('admin.branding.title')}
            </legend>

            <FormField label={t('admin.branding.accentColor')}>
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#43C194"
                pattern="^#[0-9a-fA-F]{6}$"
                style={inputStyle}
              />
            </FormField>

            <FormField label={t('admin.branding.logoUrl')}>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://cdn.tu-dominio.com/logo.svg"
                style={inputStyle}
              />
            </FormField>

            <FormField label={t('admin.branding.displayName')}>
              <input
                value={brandingDisplayName}
                onChange={(e) => setBrandingDisplayName(e.target.value)}
                maxLength={120}
                style={inputStyle}
              />
            </FormField>
          </fieldset>

          {errorKey && (
            <div
              role="alert"
              style={{
                fontSize: 'var(--font-size-sm, 13px)',
                color: 'var(--text-danger, #ff6b7a)',
              }}
            >
              {t(errorKey)}
            </div>
          )}
          {savedKey && (
            <div
              role="status"
              style={{
                fontSize: 'var(--font-size-sm, 13px)',
                color: 'var(--accent-default, #43c194)',
              }}
            >
              {t(savedKey)}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md, 8px)',
              border: 'none',
              background: 'var(--accent-default, #43c194)',
              color: '#0c1418',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm, 13px)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? t('admin.saving') : t('admin.save')}
          </button>
        </form>
      </div>
    </main>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 'var(--font-size-sm, 13px)',
          color: 'var(--text-default, #c5d1d8)',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            fontSize: 'var(--font-size-xs, 12px)',
            color: 'var(--text-muted, #87969f)',
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function PanelPlaceholder({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-bg, #0c1418)',
        color: 'var(--text-muted, #87969f)',
        fontSize: 'var(--font-size-sm, 13px)',
        padding: 'var(--spacing-6, 24px)',
        textAlign: 'center',
      }}
    >
      {message}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border-default, #1f2c33)',
  background: 'var(--surface-input, #0c1418)',
  color: 'var(--text-strong, #f0f5f8)',
  fontSize: 'var(--font-size-sm, 13px)',
  fontFamily: 'inherit',
  outline: 'none',
};
