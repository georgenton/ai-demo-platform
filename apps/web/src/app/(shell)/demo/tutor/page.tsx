// -----------------------------------------------------------------------------
// Demo 05 — Tutor de inglés con cost calculator.
//
// Layout:
//   - 2 columnas grid. Izquierda (1.05fr) chat, derecha (1fr) los paneles
//     feedback + costo apilados.
//   - Header con eyebrow + título + subtítulo + badge de status.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef, useState } from 'react';

import { TutorChatPanel } from '@/components/demo/tutor/TutorChatPanel';
import { TutorCostPanel } from '@/components/demo/tutor/TutorCostPanel';
import { TutorFeedbackPanel } from '@/components/demo/tutor/TutorFeedbackPanel';
import { extractTip } from '@/components/demo/tutor/extract-tip';
import { useSpeechRecognition } from '@/components/demo/tutor/use-speech-recognition';
import { useSpeechSynthesis } from '@/components/demo/tutor/use-speech-synthesis';
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

  // -------------------------------------------------------------------------
  // Voz (PR-D)
  // -------------------------------------------------------------------------
  const recognition = useSpeechRecognition();
  const synthesis = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useState(true);
  // Refs para detectar transiciones del stream → trigger auto-speak.
  const wasStreamingRef = useRef(false);

  const [level, setLevel] = useState<TutorLevel>('B1');
  const [scenario, setScenario] = useState<TutorScenario>('general');
  const [input, setInput] = useState('');
  const [projectionParams, setProjectionParams] = useState(DEFAULT_PROJECTION);

  const isStreaming = status === 'streaming';

  // Cuando el reconocedor entrega un transcript final, lo movemos al input.
  // Reseteamos el transcript del hook para que el próximo start() arranque
  // con buffer limpio.
  useEffect(() => {
    if (recognition.transcript) {
      setInput((prev) =>
        prev ? prev + ' ' + recognition.transcript : recognition.transcript,
      );
      recognition.reset();
    }
  }, [recognition.transcript, recognition]);

  // Auto-speak: cuando el stream pasa de 'streaming' a 'idle', tomamos el
  // último mensaje del tutor (sin el tip) y lo leemos. Solo si autoSpeak
  // está activo y el synthesis está disponible.
  useEffect(() => {
    if (
      wasStreamingRef.current &&
      !isStreaming &&
      autoSpeak &&
      synthesis.isSupported &&
      history.length > 0
    ) {
      const lastTurn = history[history.length - 1];
      if (lastTurn.role === 'assistant') {
        const { body } = extractTip(lastTurn.content);
        if (body) synthesis.speak(body);
      }
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, autoSpeak, synthesis, history]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Si el usuario manda mientras el mic está activo, lo apagamos primero.
    if (recognition.isListening) recognition.stop();
    send(trimmed, { level, scenario });
    setInput('');
  }

  function handleMicToggle() {
    if (recognition.isListening) {
      recognition.stop();
    } else {
      // Si el tutor estaba hablando, lo cortamos — no queremos que el LLM
      // siga sonando mientras el usuario habla.
      synthesis.cancel();
      recognition.start();
    }
  }

  function handleAutoSpeakToggle() {
    setAutoSpeak((on) => {
      // Si lo apagamos en medio de un speak, cortamos lo que esté sonando.
      if (on) synthesis.cancel();
      return !on;
    });
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
            voice={{
              recognitionSupported: recognition.isSupported,
              synthesisSupported: synthesis.isSupported,
              isListening: recognition.isListening,
              isSpeaking: synthesis.isSpeaking,
              interimText: recognition.interimTranscript,
              autoSpeak,
              voiceError: recognition.error,
              onMicToggle: handleMicToggle,
              onAutoSpeakToggle: handleAutoSpeakToggle,
              onCancelSpeak: synthesis.cancel,
            }}
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
