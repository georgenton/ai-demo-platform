// -----------------------------------------------------------------------------
// StageBadge — chip que muestra la etapa actual del lead. Vive en el
// header del chat. Sigue el sistema de colores del token de tokens.css:
// cada etapa avanza de gris → azul → verde según el progreso, rechazada
// va en rojo.
// -----------------------------------------------------------------------------

'use client';

import { useT } from '@/lib/i18n';
import type { LoanStage } from '@/lib/api';

interface Props {
  stage: LoanStage;
}

export function StageBadge({ stage }: Props) {
  const { t } = useT();
  const key = `loans.stage.${stage}` as const;
  return (
    <span className={`loans-stage-badge stage-${stage}`}>
      {t(key as 'loans.stage.lead')}
    </span>
  );
}
