// -----------------------------------------------------------------------------
// DocTypeSelector — 3 cards radio-like para elegir el tipo de documento.
// Visualmente: row de tarjetas con icon + título + subtítulo. La activa
// queda resaltada con borde mint.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { NotarizedDocType } from '@/lib/api';

interface Option {
  id: NotarizedDocType;
  icon: string;
  titleKey:
    | 'notarize.docType.assembly_minutes.title'
    | 'notarize.docType.loan.title'
    | 'notarize.docType.capital_contribution.title';
  subtitleKey:
    | 'notarize.docType.assembly_minutes.subtitle'
    | 'notarize.docType.loan.subtitle'
    | 'notarize.docType.capital_contribution.subtitle';
}

const OPTIONS: Option[] = [
  {
    id: 'assembly_minutes',
    icon: 'gavel',
    titleKey: 'notarize.docType.assembly_minutes.title',
    subtitleKey: 'notarize.docType.assembly_minutes.subtitle',
  },
  {
    id: 'loan',
    icon: 'banknote',
    titleKey: 'notarize.docType.loan.title',
    subtitleKey: 'notarize.docType.loan.subtitle',
  },
  {
    id: 'capital_contribution',
    icon: 'piggy-bank',
    titleKey: 'notarize.docType.capital_contribution.title',
    subtitleKey: 'notarize.docType.capital_contribution.subtitle',
  },
];

interface Props {
  value: NotarizedDocType;
  onChange: (next: NotarizedDocType) => void;
  disabled?: boolean;
}

export function DocTypeSelector({ value, onChange, disabled = false }: Props) {
  const { t } = useT();
  return (
    <div className="notarize-card-row" role="radiogroup">
      {OPTIONS.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`notarize-option${selected ? ' selected' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            <div className="notarize-option-icon">
              <Icon name={opt.icon} size={20} strokeWidth={1.6} />
            </div>
            <div className="notarize-option-text">
              <div className="notarize-option-title">{t(opt.titleKey)}</div>
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
