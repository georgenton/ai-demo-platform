// -----------------------------------------------------------------------------
// Demo 04 — Agente con tool use (SQL).
//
// Layout (kit): 3 columnas + tab switch entre Consola / Historial.
//
//   [ sugerencias | stream del agente | schema ]
//
// Wiring:
//   - useAgent() envuelve subscribeToAgent y mantiene events[].
//   - useAgentHistory() envuelve GET /agent/history para la tab.
//   - SchemaPanel es estático (catálogo local).
//
// El stream se autoscrollea al fondo a medida que llegan eventos.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, Icon } from '@/components/ui';
import { AgentEventCard } from '@/components/demo/agent/AgentEventCard';
import { HistoryTab } from '@/components/demo/agent/HistoryTab';
import { SchemaPanel } from '@/components/demo/agent/SchemaPanel';
import { SuggestedQuestions } from '@/components/demo/agent/SuggestedQuestions';
import { useAgent } from '@/components/demo/agent/use-agent';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import {
  useEstimatedCost,
  useTextDelta,
} from '@/components/shared/use-estimated-cost';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

type Tab = 'console' | 'history';
const DEMO_ID = 'agent' as const;

export default function DemoAgentPage() {
  const { t, lang } = useT();
  const [tab, setTab] = useState<Tab>('console');
  const [input, setInput] = useState('');
  const { events, status, start } = useAgent();
  const streamRef = useRef<HTMLDivElement>(null);

  const running = status === 'running';

  // Autoscroll: cuando cambia la cantidad de eventos o el texto del answer
  // en curso, pegamos al fondo.
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  });

  // Cost mini widget — pricing + acumulación estimada local.
  // El "output" del agent es heterogéneo (tokens + SQL + resultados); para
  // la estimación visual, sumamos solo los tokens del answer streameado.
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  const streamedAnswer = useMemo(() => {
    return events
      .filter(
        (e): e is { kind: 'answer'; text: string; streaming: boolean } =>
          e.kind === 'answer',
      )
      .map((e) => e.text)
      .join('');
  }, [events]);
  useTextDelta(streamedAnswer, cost.addOutput);
  const audience = getDemoAudience(DEMO_ID, t);

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || running) return;
    cost.addInput(trimmed);
    setInput('');
    start({ q: trimmed, demoId: DEMO_ID });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('agent.eyebrow')}</div>
          <h1 className="page-title">{t('agent.title')}</h1>
          <p className="page-subtitle">{t('agent.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'console'}
          className={['tab', tab === 'console' && 'active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setTab('console')}
        >
          {t('agent.tab.console')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={['tab', tab === 'history' && 'active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setTab('history')}
          // El audit log se re-fetchea cada vez que se monta el componente,
          // así que cambiar de tab y volver trae las queries nuevas.
        >
          {t('agent.tab.history')}
        </button>
      </div>

      {tab === 'console' ? (
        <div className="three-col">
          <SuggestedQuestions onPick={ask} disabled={running} />

          <main
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div
              ref={streamRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {events.length === 0 ? (
                <EmptyState
                  icon="bot"
                  title={t('agent.empty.title')}
                  body={t('agent.empty.body')}
                />
              ) : (
                events.map((event, i) => (
                  // Key combinada para asegurar remount cuando cambia el
                  // kind en la misma posición (ej. thinking → answer).
                  <AgentEventCard key={`${i}-${event.kind}`} event={event} />
                ))
              )}
            </div>

            <div className="chat-composer">
              <div className="chat-composer-inner">
                <textarea
                  className="chat-composer-input"
                  placeholder={t('agent.composer')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  rows={1}
                  disabled={running}
                />
                <button
                  type="button"
                  className="send-btn"
                  onClick={() => ask(input)}
                  disabled={!input.trim() || running}
                  aria-label={t('common.send')}
                >
                  <Icon
                    name={running ? 'square' : 'arrow-up'}
                    size={16}
                    strokeWidth={2}
                  />
                </button>
              </div>
            </div>
          </main>

          <SchemaPanel />
        </div>
      ) : (
        // Forzamos remount al volver a la tab — re-fetch del history.
        // El key includes `lang` para que un cambio de idioma también
        // refresque (raro pero barato).
        <HistoryTab key={`history-${lang}`} />
      )}
    </div>
  );
}
