// -----------------------------------------------------------------------------
// BiComposer — textarea + botón "Preguntar" estilo dashboard. Auto-resize
// hasta 5 líneas. Enter envía, Shift+Enter inserta salto.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Props {
  disabled?: boolean;
  onAsk: (text: string) => void;
}

const MAX_HEIGHT_PX = 140;

export function BiComposer({ disabled = false, onAsk }: Props) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onAsk(text);
    setValue('');
  }

  return (
    <div className="bi-composer">
      <textarea
        ref={taRef}
        className="bi-composer-input"
        placeholder={t('bi.composer.placeholder')}
        value={value}
        rows={1}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label={t('bi.composer.placeholder')}
      />
      <Button
        variant="primary"
        size="md"
        icon={disabled ? 'loader' : 'send'}
        disabled={disabled || value.trim().length === 0}
        onClick={submit}
      >
        {disabled ? t('bi.composer.sending') : t('bi.composer.send')}
      </Button>
    </div>
  );
}

interface SuggestionsProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function BiSuggestions({ onPick, disabled = false }: SuggestionsProps) {
  const { t } = useT();
  const items = [
    t('bi.suggestions.q1'),
    t('bi.suggestions.q2'),
    t('bi.suggestions.q3'),
    t('bi.suggestions.q4'),
    t('bi.suggestions.q5'),
  ];

  return (
    <div className="bi-suggestions">
      <div className="bi-suggestions-title">
        <Icon name="sparkles" size={14} />
        <span>{t('bi.suggestions.title')}</span>
      </div>
      <div className="bi-suggestions-list">
        {items.map((q) => (
          <button
            key={q}
            type="button"
            className="bi-suggestion-chip"
            onClick={() => onPick(q)}
            disabled={disabled}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
