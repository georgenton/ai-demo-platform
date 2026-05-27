// LangSwitch — segmented control ES / EN del header.
// Port del LangChip / LangSwitch del kit (Shell.jsx), tipado y limpio.

'use client';

import { useT } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div
      role="group"
      title={t('shell.lang.tip')}
      style={{
        display: 'inline-flex',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-elevated)',
        height: 32,
        padding: 2,
        boxShadow: 'var(--shadow-inset)',
      }}
    >
      <LangChip
        code="es"
        active={lang === 'es'}
        onClick={() => lang !== 'es' && setLang('es')}
      />
      <LangChip
        code="en"
        active={lang === 'en'}
        onClick={() => lang !== 'en' && setLang('en')}
      />
    </div>
  );
}

interface LangChipProps {
  code: Lang;
  active: boolean;
  onClick: () => void;
}

function LangChip({ code, active, onClick }: LangChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? '1' : '0'}
      aria-pressed={active}
      style={{
        font: 'inherit',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '0 9px',
        height: 26,
        minWidth: 30,
        background: active ? 'var(--lang-active-bg)' : 'transparent',
        color: active ? 'var(--lang-active-fg)' : 'var(--color-fg-muted)',
        border: 0,
        borderRadius: 4,
        cursor: active ? 'default' : 'pointer',
        transition:
          'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
      }}
    >
      {code}
    </button>
  );
}
