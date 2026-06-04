// -----------------------------------------------------------------------------
// Pantalla 2b — "Has completado las N preguntas. Generar evaluación."
//
// Aparece después de la última respuesta confirmada. Phase del hook:
// 'ready_to_finalize'. Click → dispara el SSE del finalize.
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Props {
  total: number;
  onFinalize: () => void;
}

export function ReadyPanel({ total, onFinalize }: Props) {
  const { t } = useT();
  return (
    <div className="iv-scroll">
      <div className="iv-ready">
        <div className="iv-ready-icon">
          <Icon name="clipboard-check" size={30} strokeWidth={1.5} />
        </div>
        <h2 className="iv-ready-title">
          {t('interview.ready.title', { n: total })}
        </h2>
        <p className="iv-ready-sub">{t('interview.ready.subtitle')}</p>
        <Button
          variant="primary"
          size="lg"
          icon="sparkles"
          onClick={onFinalize}
        >
          {t('interview.ready.finalize')}
        </Button>
      </div>
    </div>
  );
}
