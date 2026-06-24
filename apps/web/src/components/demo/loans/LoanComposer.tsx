// -----------------------------------------------------------------------------
// LoanComposer — input + botón de envío al estilo WhatsApp. Auto-resize
// del textarea hasta 4 líneas; Enter envía, Shift+Enter inserta salto.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Props {
  disabled?: boolean;
  onSend: (message: string) => void;
}

const MAX_HEIGHT_PX = 120;

export function LoanComposer({ disabled = false, onSend }: Props) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <div className="loans-composer">
      <textarea
        ref={taRef}
        className="loans-composer-input"
        placeholder={t('loans.composer.placeholder')}
        value={value}
        disabled={disabled}
        rows={1}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        aria-label={t('loans.composer.placeholder')}
      />
      <button
        type="button"
        className="loans-composer-send"
        onClick={handleSend}
        disabled={disabled || value.trim().length === 0}
        aria-label={t('loans.composer.send')}
      >
        <Icon name="send" size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
