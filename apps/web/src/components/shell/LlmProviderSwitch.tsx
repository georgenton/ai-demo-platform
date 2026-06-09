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

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/ui';
import { useLlmProvider, type LlmProviderId } from '@/lib/llm';
import { useT } from '@/lib/i18n';

interface ProviderOption {
  id: LlmProviderId;
  /** Nombre Lucide del icono. */
  icon: string;
  /** Clave i18n del label visible. */
  labelKey: 'llm.provider.anthropic' | 'llm.provider.privateMac';
  /**
   * Badge opcional al lado del label (ej. "sin RAG" cuando un provider no
   * tiene embeddings — ADR-0018). Aparece en el menú y en el tooltip.
   */
  badgeKey?: 'llm.provider.anthropicNoRag';
  /** Tooltip del badge para explicar el porqué. */
  badgeHintKey?: 'llm.provider.anthropicNoRagHint';
}

const OPTIONS: ProviderOption[] = [
  {
    id: 'anthropic',
    icon: 'cloud',
    labelKey: 'llm.provider.anthropic',
    // Anthropic no fabrica embeddings; los demos que indexan/buscan
    // documentos (RAG, corpus) quedan bloqueados con este provider. El
    // badge avisa al user antes de que elija.
    badgeKey: 'llm.provider.anthropicNoRag',
    badgeHintKey: 'llm.provider.anthropicNoRagHint',
  },
  { id: 'private-mac', icon: 'server', labelKey: 'llm.provider.privateMac' },
];

export function LlmProviderSwitch() {
  const { t } = useT();
  const { provider, setProvider } = useLlmProvider();
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
                title={opt.badgeHintKey ? t(opt.badgeHintKey) : undefined}
              >
                <Icon name={opt.icon} size={14} />
                <span>{t(opt.labelKey)}</span>
                {opt.badgeKey && (
                  <span className="llm-switch-badge">{t(opt.badgeKey)}</span>
                )}
                {selected && <Icon name="check" size={13} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
