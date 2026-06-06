// -----------------------------------------------------------------------------
// Header — barra sticky superior con frosted background.
//
// Estructura del kit:
//   - Izquierda: KICKER "DEMO · 01" + nombre del demo activo.
//   - Centro: link de provider visible ("Anthropic API → NAI on-prem") con
//     badge de entorno. Es ESTÁTICO/decorativo en el kit — el cliente ve
//     que el sistema "habla de" infrastructure switching, que es el core
//     value prop de la plataforma.
//   - Derecha: LangSwitch + ThemeToggle.
//
// El demo activo se deriva de `usePathname()` cruzando con el catálogo.
// Si la URL no matchea ningún demo (ej. `/foo`), fallback al primero.
// -----------------------------------------------------------------------------

'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { Badge } from '@/components/ui';
import { buildSidebarDemos } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

import { LangSwitch } from './LangSwitch';
import { LlmProviderSwitch } from './LlmProviderSwitch';
import { PresentationToggle } from './PresentationToggle';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export function Header() {
  const { t, lang } = useT();
  const pathname = usePathname() ?? '';

  const demos = useMemo(() => buildSidebarDemos(t), [t, lang]);

  // Index del demo activo. Si no hay match, usamos el primero (0) —
  // mejor que mostrar el header vacío en la landing.
  const activeIndex = useMemo(() => {
    const idx = demos.findIndex((demo) => pathname.startsWith(demo.route));
    return idx >= 0 ? idx : 0;
  }, [demos, pathname]);

  const active = demos[activeIndex];
  const demoNumber = String(activeIndex + 1).padStart(2, '0');

  return (
    <header className="header">
      <div className="header-title">
        <span className="header-eyebrow">
          {t('header.demo')} · {demoNumber}
        </span>
        <span className="header-name">{active?.title}</span>
      </div>

      <div className="spacer" />

      {/* Switch dinámico Anthropic ↔ NAI on-prem. Antes era un bloque
          estático "Anthropic API → NAI on-prem · dev" puramente decorativo;
          ahora refleja la elección real del usuario (ver
          LlmProviderSwitch.tsx + lib/llm/llm-provider-context.tsx). */}
      <div
        className="row"
        style={{
          gap: 8,
          fontSize: 12,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <LlmProviderSwitch />
        <Badge tone="info">{t('shell.dev')}</Badge>
      </div>

      <LangSwitch />
      <ThemeToggle />
      <PresentationToggle />
      <UserMenu />
    </header>
  );
}
