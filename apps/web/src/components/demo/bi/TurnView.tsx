// -----------------------------------------------------------------------------
// TurnView — un turn conversacional completo en la UI. Se compone de:
//
//   1. Pregunta del usuario (chip arriba).
//   2. Indicadores de progreso (running SQL / choosing chart) mientras
//      streamea.
//   3. Narrativa del bot (texto plano con caret de streaming).
//   4. Gráfico dinámico (DynamicChart) si hay spec.
//   5. Tabla colapsable de filas.
//   6. Bloque SQL colapsado por default.
//   7. Panel de error si hubo.
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

import { DynamicChart } from './DynamicChart';
import { SaveToDashboard } from './SaveToDashboard';
import { SqlBlock } from './SqlBlock';
import { SqlResultTable } from './SqlResultTable';
import type { BiTurn } from './use-bi-chat';

interface Props {
  turn: BiTurn;
  onRetry?: () => void;
}

export function TurnView({ turn, onRetry }: Props) {
  const { t } = useT();
  const hasRows = turn.columns.length > 0;
  const hasChart = !!turn.chart;
  const showingNarrative = turn.narrative.length > 0;

  return (
    <article className="bi-turn">
      <header className="bi-turn-question">
        <Icon name="message-circle-question" size={16} />
        <span>{turn.question}</span>
      </header>

      {turn.streaming && !hasRows && !showingNarrative && (
        <div className="bi-turn-status">
          <Icon name="loader" size={16} />
          <span>{t('bi.thinking')}</span>
        </div>
      )}

      {turn.streaming && hasRows && !hasChart && (
        <div className="bi-turn-status">
          <Icon name="loader" size={16} />
          <span>{t('bi.choosingChart')}</span>
        </div>
      )}

      {hasChart && (
        <DynamicChart
          spec={turn.chart!}
          columns={turn.columns}
          rows={turn.rows}
        />
      )}

      {showingNarrative && (
        <div className="bi-turn-narrative">
          <p>
            {turn.narrative}
            {turn.streaming && (
              <span className="bi-narrative-caret" aria-hidden="true" />
            )}
          </p>
        </div>
      )}

      {hasRows && (
        <SqlResultTable
          columns={turn.columns}
          rows={turn.rows}
          rowCount={turn.rowCount}
        />
      )}

      {turn.chart && turn.sql && !turn.error && (
        <div className="bi-turn-actions">
          <SaveToDashboard
            question={turn.question}
            sql={turn.sql}
            chartSpec={turn.chart}
          />
        </div>
      )}

      {turn.sql && <SqlBlock sql={turn.sql} tablesUsed={turn.tablesUsed} />}

      {turn.error && (
        <div className="bi-turn-error" role="alert">
          <div className="bi-turn-error-icon">
            <Icon name="triangle-alert" size={18} />
          </div>
          <div className="bi-turn-error-text">
            <div className="bi-turn-error-title">{t('bi.error.title')}</div>
            <div className="bi-turn-error-msg">{turn.error}</div>
          </div>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t('bi.error.retry')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
