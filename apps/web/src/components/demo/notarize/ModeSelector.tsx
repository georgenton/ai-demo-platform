// -----------------------------------------------------------------------------
// ModeSelector — radio de 3 opciones para elegir dónde quedan los sellos.
// Mismo estilo visual que DocTypeSelector (radio cards con icon).
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { NotarizeMode } from '@/lib/api';

interface Option {
  id: NotarizeMode;
  icon: string;
  titleKey:
    | 'notarize.mode.local.title'
    | 'notarize.mode.public.title'
    | 'notarize.mode.both.title';
  subtitleKey:
    | 'notarize.mode.local.subtitle'
    | 'notarize.mode.public.subtitle'
    | 'notarize.mode.both.subtitle';
  badgeKey?: 'notarize.mode.pendingBadge';
  disabled?: boolean;
}

const OPTIONS: Option[] = [
  {
    id: 'local',
    icon: 'server',
    titleKey: 'notarize.mode.local.title',
    subtitleKey: 'notarize.mode.local.subtitle',
  },
  {
    id: 'public',
    icon: 'cloud',
    titleKey: 'notarize.mode.public.title',
    subtitleKey: 'notarize.mode.public.subtitle',
    badgeKey: 'notarize.mode.pendingBadge',
    disabled: true,
  },
  {
    id: 'both',
    icon: 'shield-check',
    titleKey: 'notarize.mode.both.title',
    subtitleKey: 'notarize.mode.both.subtitle',
    badgeKey: 'notarize.mode.pendingBadge',
    disabled: true,
  },
];

interface Props {
  value: NotarizeMode;
  onChange: (next: NotarizeMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled = false }: Props) {
  const { t } = useT();
  return (
    <div className="notarize-card-row" role="radiogroup">
      {OPTIONS.map((opt) => {
        const selected = opt.id === value;
        const optionDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={optionDisabled}
            className={`notarize-option${selected ? ' selected' : ''}${opt.disabled ? ' unavailable' : ''}`}
            onClick={() => {
              if (!optionDisabled) onChange(opt.id);
            }}
          >
            <div className="notarize-option-icon">
              <Icon name={opt.icon} size={20} strokeWidth={1.6} />
            </div>
            <div className="notarize-option-text">
              <div className="notarize-option-title">
                <span>{t(opt.titleKey)}</span>
                {opt.badgeKey && (
                  <span className="notarize-option-badge">
                    {t(opt.badgeKey)}
                  </span>
                )}
              </div>
              <div className="notarize-option-subtitle">
                {t(opt.subtitleKey)}
              </div>
            </div>
            {selected && (
              <Icon
                name="check-circle-2"
                size={18}
                strokeWidth={2}
                className="notarize-option-check"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
