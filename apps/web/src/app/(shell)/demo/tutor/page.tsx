// -----------------------------------------------------------------------------
// Demo 05 — Tutor de inglés con cost calculator.
//
// Layout:
//   - 2 columnas grid. Izquierda (1.05fr) chat, derecha (1fr) los paneles
//     feedback + costo apilados.
//   - Header con eyebrow + título + subtítulo + badge de status.
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { TutorChatPanel } from '@/components/demo/tutor/TutorChatPanel';
import { TutorCostPanel } from '@/components/demo/tutor/TutorCostPanel';
import { TutorFeedbackPanel } from '@/components/demo/tutor/TutorFeedbackPanel';
import { useTutorChat } from '@/components/demo/tutor/use-tutor-chat';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { useT } from '@/lib/i18n';
import type { TutorLevel, TutorScenario } from '@/lib/api';

const DEFAULT_PROJECTION = {
  students: 500,
  sessionsPerWeek: 3,
  weeksInSemester: 16,
};

export default function DemoTutorPage() {
  const { t } = useT();
  const {
    history,
    streamingText,
    status,
    totalUsage,
    lastError,
    send,
    cancel,
    reset,
  } = useTutorChat();
  const {
    pricing,
    status: pricingStatus,
    error: pricingError,
  } = useTutorPricing();

  const [level, setLevel] = useState<TutorLevel>('B1');
  const [scenario, setScenario] = useState<TutorScenario>('general');
  const [input, setInput] = useState('');
  const [projectionParams, setProjectionParams] = useState(DEFAULT_PROJECTION);

  const isStreaming = status === 'streaming';

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    send(trimmed, { level, scenario });
    setInput('');
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('tutor.eyebrow')}</div>
          <h1 className="page-title">{t('tutor.title')}</h1>
          <p className="page-subtitle">{t('tutor.subtitle')}</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: 24,
          minHeight: 560,
        }}
      >
        <div style={{ minHeight: 0 }}>
          <TutorChatPanel
            history={history}
            streamingText={streamingText}
            isStreaming={isStreaming}
            level={level}
            scenario={scenario}
            inputValue={input}
            errorMessage={lastError}
            onLevelChange={setLevel}
            onScenarioChange={setScenario}
            onInputChange={setInput}
            onSend={handleSend}
            onCancel={cancel}
            onReset={reset}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 0,
          }}
        >
          <TutorFeedbackPanel history={history} />
          <TutorCostPanel
            sessionUsage={totalUsage}
            pricing={pricing}
            pricingLoading={pricingStatus === 'loading'}
            pricingError={pricingError}
            params={projectionParams}
            onParamsChange={setProjectionParams}
          />
        </div>
      </div>
    </div>
  );
}
