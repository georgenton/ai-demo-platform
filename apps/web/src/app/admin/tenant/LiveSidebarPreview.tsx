// -----------------------------------------------------------------------------
// LiveSidebarPreview — sidebar miniaturizado que se actualiza en vivo mientras
// el admin edita el branding del tenant en /admin/tenant.
//
// Implementa la MISMA lógica que el Sidebar real:
//   - Lockup adaptativo según presencia de logoUrl.
//   - Guarda de contraste WCAG estricta theme-aware (resolveAccentStrict).
//   - Filtrado de demos por enabledDemoIds del form.
//
// No es un "Sidebar mock" — usa las mismas clases CSS y el mismo util de
// contraste que el real. Si el admin elige un color que falla, ve aquí el
// fallback mint-600 aplicado (igual que lo verá en el sidebar después de
// guardar). Eso da feedback inmediato sin viajar al backend.
// -----------------------------------------------------------------------------

'use client';

import Image from 'next/image';

import { Icon } from '@/components/ui';
import { resolveAccentStrict } from '@/lib/branding/contrast';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export interface LivePreviewDemo {
  id: string;
  title: string;
  /** Lucide icon name (kebab-case). */
  icon: string;
}

export interface LiveSidebarPreviewProps {
  tenantDisplayName: string;
  accentColor: string;
  logoUrl: string;
  demos: LivePreviewDemo[];
}

export function LiveSidebarPreview({
  tenantDisplayName,
  accentColor,
  logoUrl,
  demos,
}: LiveSidebarPreviewProps) {
  const { t } = useT();
  const { theme } = useTheme();

  const resolved = resolveAccentStrict(accentColor);
  const hasLogo = !!logoUrl;

  const defaultLogo =
    theme === 'dark' ? '/brand/logo-mark-on-dark.svg' : '/brand/logo-mark.svg';

  const accentStyle = {
    ['--color-accent']: resolved,
  } as React.CSSProperties;

  return (
    <aside
      className="sidebar"
      style={{
        ...accentStyle,
        height: 420,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {hasLogo ? (
        <div className="sidebar-brand sidebar-brand--tenant">
          <img
            className="tenant-logo"
            src={logoUrl}
            alt=""
            onError={(e) => {
              // Fallback silencioso si la URL no carga — el admin verá
              // que el preview "no funciona" y reaccionará.
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="sidebar-brand sidebar-brand--default">
          <Image
            className="sidebar-brand-mark"
            src={defaultLogo}
            width={26}
            height={26}
            alt=""
            aria-hidden
          />
          <div className="sidebar-brand-text">
            <div
              className="sidebar-brand-name"
              title={tenantDisplayName}
              style={{ fontSize: 13 }}
            >
              {tenantDisplayName}
            </div>
            <div className="sidebar-brand-tag">{t('shell.brand.tag')}</div>
          </div>
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        aria-hidden
      >
        <div className="sidebar-section-label">{t('shell.demos')}</div>
        {demos.map((demo, i) => (
          <div
            key={demo.id}
            className={['demo-item', i === 0 && 'active']
              .filter(Boolean)
              .join(' ')}
            style={{ textDecoration: 'none' }}
          >
            <Icon name={demo.icon} size={16} className="demo-item-icon" />
            <div className="demo-item-body">
              <div className="demo-item-title" style={{ fontSize: 12 }}>
                {demo.title}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {hasLogo && (
        <div className="sidebar-foot">
          <Image src={defaultLogo} width={18} height={18} alt="" aria-hidden />
          <div className="pb">
            <span className="pb-label">{t('shell.brand.poweredBy')}</span>
            <span className="pb-tag">{t('shell.brand.tag')}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
