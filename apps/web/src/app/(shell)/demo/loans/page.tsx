// -----------------------------------------------------------------------------
// Demo 09 — Vista socio del funnel de préstamos (ADR-0020).
//
// UI tipo WhatsApp: header con avatar de Coopi + badge de etapa, lista
// de bubbles (user verde a la derecha / bot blanco a la izquierda /
// system gris centrado), composer abajo.
//
// El estado lo maneja useLoanChat que abre el SSE al backend y va
// llenando el último bubble assistant a medida que llegan tokens.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef } from 'react';

import { Button, Eyebrow, Icon } from '@/components/ui';
import { EligibilityCard } from '@/components/demo/loans/EligibilityCard';
import { LoanComposer } from '@/components/demo/loans/LoanComposer';
import { LoanFunnelStepper } from '@/components/demo/loans/LoanFunnelStepper';
import { LoanSuggestedQuestions } from '@/components/demo/loans/LoanSuggestedQuestions';
import { MessageBubble } from '@/components/demo/loans/MessageBubble';
import { StageBadge } from '@/components/demo/loans/StageBadge';
import { useLoanChat } from '@/components/demo/loans/use-loan-chat';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { useEstimatedCost } from '@/components/shared/use-estimated-cost';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

const DEMO_ID = 'loans' as const;

export default function DemoLoansPage() {
  const { t } = useT();
  const audience = getDemoAudience(DEMO_ID, t);
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  const chat = useLoanChat();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al bottom cuando llegan tokens nuevos.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isStreaming]);

  return (
    <div className="page loans-page">
      {/* Header de la página */}
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('loans.eyebrow')}</div>
          <h1 className="page-title">{t('loans.title')}</h1>
          <p className="page-subtitle">{t('loans.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
        </div>
      </div>

      {/* Chat tipo WhatsApp */}
      <section className="loans-chat" aria-label="Chat con Coopi">
        {/* Header del chat */}
        <header className="loans-chat-header">
          <div className="loans-chat-avatar" aria-hidden="true">
            <Icon name="message-square-heart" size={22} strokeWidth={1.6} />
          </div>
          <div className="loans-chat-titles">
            <div className="loans-chat-title">
              {t('loans.header.assistant')}
            </div>
            <div className="loans-chat-subtitle">
              <span className="loans-status-dot" aria-hidden="true" />
              {t('loans.header.online')}
            </div>
          </div>
          <StageBadge stage={chat.currentStage} />
        </header>

        {/* Mini-funnel horizontal: muestra en qué etapa está el lead activo.
            Se mueve en vivo cuando llega el evento `stage_changed` del SSE. */}
        <LoanFunnelStepper stage={chat.currentStage} />

        {/* Lista de mensajes */}
        <div className="loans-chat-messages" ref={scrollRef}>
          <Eyebrow>{t('loans.intro.title')}</Eyebrow>
          <p className="loans-chat-intro">{t('loans.intro.body')}</p>

          {chat.messages.map((msg) => {
            if (msg.eligibility) {
              return (
                <MessageBubble
                  key={msg.id}
                  role="assistant"
                  time={msg.time}
                  content={<EligibilityCard result={msg.eligibility} />}
                />
              );
            }
            return (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                time={msg.role === 'system' ? undefined : msg.time}
                content={
                  msg.role === 'system' ? (
                    <SystemContent toolName={msg.toolName} summary={msg.text} />
                  ) : (
                    msg.text
                  )
                }
                streaming={
                  msg.role === 'assistant' &&
                  chat.isStreaming &&
                  msg.id === chat.messages[chat.messages.length - 1]?.id
                }
              />
            );
          })}

          {chat.error && (
            <div className="loans-chat-error" role="alert">
              <div className="loans-chat-error-icon">
                <Icon name="triangle-alert" size={18} />
              </div>
              <div className="loans-chat-error-text">
                <div className="loans-chat-error-title">
                  {t('loans.error.title')}
                </div>
                <div className="loans-chat-error-msg">{chat.error}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={chat.retry}>
                {t('loans.error.retry')}
              </Button>
            </div>
          )}
        </div>

        {/* Preguntas sugeridas — el vendedor click y envia para guiar la
            demo paso a paso por el funnel. */}
        <LoanSuggestedQuestions
          disabled={chat.isStreaming}
          onPick={chat.send}
        />

        {/* Composer */}
        <LoanComposer disabled={chat.isStreaming} onSend={chat.send} />
      </section>
    </div>
  );
}

interface SystemContentProps {
  toolName?: string;
  summary: string;
}

function SystemContent({ toolName, summary }: SystemContentProps) {
  const { t } = useT();
  const label = toolName
    ? t(`loans.system.tool.${toolName}` as 'loans.system.tool.register_lead')
    : null;
  return (
    <>
      {label && <strong>{label} · </strong>}
      <span>{summary}</span>
    </>
  );
}
