// -----------------------------------------------------------------------------
// Pantalla de error — visible si phase === 'error'.
//
// La mayoría de los errores del flujo van por phase 'error' del hook
// (start/submit/finalize fallidos). El message viene del hook.
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Props {
  message: string | null;
  onRestart: () => void;
}

export function ErrorPanel({ message, onRestart }: Props) {
  const { t } = useT();
  return (
    <div className="iv-scroll">
      <div className="iv-ready">
        <div className="iv-ready-icon error">
          <Icon name="triangle-alert" size={28} strokeWidth={1.6} />
        </div>
        <h2 className="iv-ready-title">{t('interview.error.title')}</h2>
        <p className="iv-ready-sub">{message ?? ''}</p>
        <Button
          variant="secondary"
          size="lg"
          icon="rotate-ccw"
          onClick={onRestart}
        >
          {t('interview.error.restart')}
        </Button>
      </div>
    </div>
  );
}
