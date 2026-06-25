// -----------------------------------------------------------------------------
// LlmProviderSwitch — dropdown del header para elegir Anthropic ↔ NAI on-prem.
//
// Reemplaza el bloque estático "Anthropic API → NAI on-prem · dev" que era
// decorativo. Hoy refleja la elección real del usuario y la persiste en
// localStorage (ver llm-provider-context.tsx).
//
// Estados visuales:
//   - sin elegir (provider === null): label "Elige modelo" con pulse suave
//     para llamar la atención. Click → abre menú.
//   - elegido: label con el provider activo + icon del provider. Click →
//     abre menú para cambiar.
//
// Sin focus-trap ni accessibility avanzado en esta primera vuelta — es un
// dropdown chico, escape lo cierra, click fuera lo cierra. Mismo nivel de
// polish que el UserMenu actual.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLlmProvider, type LlmProviderId } from '@/lib/llm';
import { useT } from '@/lib/i18n';

interface ProviderOption {
  id: LlmProviderId;
  /** Nombre Lucide del icono. */
  icon: string;
  /** Clave i18n del label visible. */
  labelKey:
    | 'llm.provider.anthropic'
    | 'llm.provider.privateMac'
    | 'llm.provider.privateOnprem';
}

/**
 * Catálogo completo de opciones del switch. La función
 * `optionsForRole` decide cuáles ve cada user:
 *
 *   - `admin` / `superadmin` → 3 opciones (Anthropic, Mac local, Ubuntu).
 *   - `member` (equipo de ventas) → 2 opciones (Anthropic, Ubuntu).
 *
 * NAI (`openai-compat`) se excluye del switch porque hoy se setea a nivel
 * de tenant en `/admin/tenant`, no por sesión del user.
 *
 * El badge "sin RAG" para Anthropic se eliminó: el backend ahora cae al
 * `EMBEDDINGS_PROVIDER` del env (OpenAI cloud) cuando el chat=Anthropic,
 * así que RAG funciona en los 3 providers.
 */
const ALL_OPTIONS: Record<
  Exclude<LlmProviderId, 'openai-compat'>,
  ProviderOption
> = {
  anthropic: {
    id: 'anthropic',
    icon: 'cloud',
    labelKey: 'llm.provider.anthropic',
  },
  'private-mac': {
    id: 'private-mac',
    icon: 'server',
    labelKey: 'llm.provider.privateMac',
  },
  'private-onprem': {
    id: 'private-onprem',
    icon: 'hard-drive',
    labelKey: 'llm.provider.privateOnprem',
  },
};

function optionsForRole(role: string | undefined): ProviderOption[] {
  // Default conservador: si no sabemos el rol todavía, mostramos solo las
  // 2 opciones de ventas. Cuando `useAuth` hidrata, el menú se actualiza.
  const isAdmin = role === 'admin' || role === 'superadmin';
  if (isAdmin) {
    return [
      ALL_OPTIONS.anthropic,
      ALL_OPTIONS['private-mac'],
      ALL_OPTIONS['private-onprem'],
    ];
  }
  return [ALL_OPTIONS.anthropic, ALL_OPTIONS['private-onprem']];
}

export function LlmProviderSwitch() {
  const { t } = useT();
  const { provider, setProvider } = useLlmProvider();
  const auth = useAuth();
  const OPTIONS = useMemo(
    () => optionsForRole(auth.user?.role),
    [auth.user?.role],
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cierre al click fuera o Escape.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeOption = OPTIONS.find((o) => o.id === provider);

  return (
    <div className="llm-switch" ref={wrapRef}>
      <button
        type="button"
        className={`llm-switch-trigger${provider ? '' : ' pending'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          provider ? t('llm.provider.changeHint') : t('llm.provider.chooseHint')
        }
      >
        <Icon name={activeOption?.icon ?? 'globe'} size={14} />
        <span>
          {activeOption ? t(activeOption.labelKey) : t('llm.provider.choose')}
        </span>
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <div className="llm-switch-menu" role="menu">
          {OPTIONS.map((opt) => {
            const selected = opt.id === provider;
            return (
              <button
                type="button"
                key={opt.id}
                role="menuitem"
                className={`llm-switch-item${selected ? ' selected' : ''}`}
                onClick={() => {
                  setProvider(opt.id);
                  setOpen(false);
                }}
              >
                <Icon name={opt.icon} size={14} />
                <span>{t(opt.labelKey)}</span>
                {selected && <Icon name="check" size={13} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
