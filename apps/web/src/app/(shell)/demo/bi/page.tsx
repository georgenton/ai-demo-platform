// -----------------------------------------------------------------------------
// Demo 10 — Dashboard inteligente / BI dinámico (ADR-0021).
//
// UI minimalista: composer arriba + lista de turns hacia abajo. Cada turn
// trae pregunta + gráfico + narrativa + tabla + SQL (colapsado).
//
// El estado vive en useBiChat. El SSE actualiza el último turn en vivo.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef } from 'react';

import { Button, Eyebrow, Icon } from '@/components/ui';
import { BiComposer, BiSuggestions } from '@/components/demo/bi/BiComposer';
import { TurnView } from '@/components/demo/bi/TurnView';
import { useBiChat } from '@/components/demo/bi/use-bi-chat';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { useEstimatedCost } from '@/components/shared/use-estimated-cost';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

const DEMO_ID = 'bi' as const;

export default function DemoBiPage() {
  const { t } = useT();
  const audience = getDemoAudience(DEMO_ID, t);
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  const chat = useBiChat();

  // Auto-scroll al último turn cuando llegan tokens.
  const lastTurnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lastTurnRef.current) return;
    lastTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chat.turns.length]);

  const isStreaming = chat.status === 'streaming';
  const hasAny = chat.turns.length > 0;

  return (
    <div className="page bi-page">
      {/* Header de la página */}
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('bi.eyebrow')}</div>
          <h1 className="page-title">{t('bi.title')}</h1>
          <p className="page-subtitle">{t('bi.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          {hasAny && (
            <Button
              variant="secondary"
              icon="rotate-cw"
              size="sm"
              onClick={chat.reset}
            >
              {t('bi.suggestions.title')}
            </Button>
          )}
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
        </div>
      </div>

      {/* Composer + Suggestions */}
      <section className="bi-composer-wrap" aria-label="Ask a question">
        <BiComposer disabled={isStreaming} onAsk={chat.ask} />
        {!hasAny && <BiSuggestions onPick={chat.ask} disabled={isStreaming} />}
      </section>

      {/* Body */}
      {!hasAny ? (
        <div className="bi-empty">
          <div className="bi-empty-icon">
            <Icon name="bar-chart-3" size={42} strokeWidth={1.4} />
          </div>
          <Eyebrow>{t('bi.empty.title')}</Eyebrow>
          <p className="bi-empty-body">{t('bi.empty.body')}</p>
        </div>
      ) : (
        <div className="bi-turns">
          {chat.turns.map((turn, i) => {
            const isLast = i === chat.turns.length - 1;
            return (
              <div
                key={turn.id}
                ref={isLast ? lastTurnRef : undefined}
                className="bi-turn-wrapper"
              >
                <TurnView
                  turn={turn}
                  onRetry={isLast ? chat.retry : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
