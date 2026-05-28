// -----------------------------------------------------------------------------
// TutorChatPanel — Panel 1 del Demo 05.
//
// Estructura visual reusada del Demo 01 (RAG): `.chat-shell` con stream +
// composer + pills de quick-start. Lo nuevo respecto al RAG:
//   - Selectores de nivel CEFR y escenario al top del panel.
//   - Pills de quick-start dependen del escenario activo.
//   - No hay sidebar de documentos — el tutor no usa retrieval.
// -----------------------------------------------------------------------------

'use client';

import { type FormEvent, useEffect, useRef } from 'react';

import { Button, Icon, Pill } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { TutorHistoryTurn, TutorLevel, TutorScenario } from '@/lib/api';

import { TutorBubble } from './TutorBubble';

const LEVELS: TutorLevel[] = ['A2', 'B1', 'B2'];
const SCENARIOS: TutorScenario[] = ['general', 'cafe', 'interview'];

/** Quick-start pills por escenario (inglés — son los seeds que el usuario manda). */
const QUICK_STARTS: Record<TutorScenario, string[]> = {
  general: [
    'Hello! How are you today?',
    'I want to talk about my weekend.',
    'Can you ask me about my hobbies?',
  ],
  cafe: [
    'Hi, can I see the menu please?',
    "I'd like to order a coffee.",
    'How much is a small latte?',
  ],
  interview: [
    'Tell me about a typical interview question.',
    'Can you ask me about my work experience?',
    'I would like to practice answering "Tell me about yourself".',
  ],
};

export interface TutorChatPanelProps {
  history: TutorHistoryTurn[];
  streamingText: string;
  isStreaming: boolean;
  level: TutorLevel;
  scenario: TutorScenario;
  inputValue: string;
  errorMessage: string | null;
  onLevelChange: (level: TutorLevel) => void;
  onScenarioChange: (scenario: TutorScenario) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function TutorChatPanel({
  history,
  streamingText,
  isStreaming,
  level,
  scenario,
  inputValue,
  errorMessage,
  onLevelChange,
  onScenarioChange,
  onInputChange,
  onSend,
  onCancel,
  onReset,
}: TutorChatPanelProps) {
  const { t } = useT();
  const streamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al fondo cada vez que se agrega un turn o cambia el stream.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, streamingText]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    onSend();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 12,
      }}
    >
      {/* Controles arriba: nivel + escenario + reset */}
      <div
        className="row"
        style={{
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="eyebrow" style={{ fontSize: 11, marginRight: 4 }}>
              {t('tutor.level.label')}
            </span>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => onLevelChange(lv)}
                className={`badge ${
                  level === lv ? 'badge-accent' : 'badge-neutral'
                }`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontSize: 12,
                  background: level === lv ? 'var(--nai-mint-500)' : undefined,
                  color: level === lv ? 'var(--nai-navy-900)' : undefined,
                }}
              >
                {lv}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="eyebrow" style={{ fontSize: 11, marginRight: 4 }}>
              {t('tutor.scenario.label')}
            </span>
            {SCENARIOS.map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => onScenarioChange(sc)}
                className={`badge ${
                  scenario === sc ? 'badge-accent' : 'badge-neutral'
                }`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontSize: 12,
                  background:
                    scenario === sc ? 'var(--nai-mint-500)' : undefined,
                  color: scenario === sc ? 'var(--nai-navy-900)' : undefined,
                }}
              >
                {t(`tutor.scenario.${sc}`)}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon="rotate-ccw"
          onClick={onReset}
          disabled={isStreaming || history.length === 0}
        >
          {t('tutor.reset')}
        </Button>
      </div>

      {/* Chat stream */}
      <div className="chat-shell" style={{ flex: 1, minHeight: 0 }}>
        <div className="chat-stream" ref={streamRef}>
          <div className="chat-stream-header-fade" aria-hidden />
          {history.length === 0 && !streamingText && (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--color-fg-subtle)',
                fontSize: 13,
              }}
            >
              {t('tutor.chat.empty')}
            </div>
          )}
          {history.map((turn, i) => (
            <TutorBubble key={i} role={turn.role} text={turn.content} />
          ))}
          {streamingText && (
            <TutorBubble
              role="assistant"
              text={streamingText}
              streaming={isStreaming}
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="chat-composer">
          <div className="chat-composer-inner">
            <textarea
              className="chat-composer-input"
              placeholder={t('tutor.composer.placeholder')}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming && inputValue.trim()) onSend();
                }
              }}
              rows={1}
              disabled={isStreaming}
            />
            <button
              type={isStreaming ? 'button' : 'submit'}
              className="send-btn"
              onClick={isStreaming ? onCancel : undefined}
              disabled={!isStreaming && !inputValue.trim()}
              aria-label={isStreaming ? t('common.cancel') : t('common.send')}
            >
              <Icon
                name={isStreaming ? 'square' : 'arrow-up'}
                size={16}
                strokeWidth={2}
              />
            </button>
          </div>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {QUICK_STARTS[scenario].map((q) => (
              <Pill key={q} icon="sparkles" onClick={() => onInputChange(q)}>
                {q}
              </Pill>
            ))}
          </div>
        </form>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: 12,
            background: 'var(--color-danger-soft)',
            color: 'var(--color-danger)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
