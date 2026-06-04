// -----------------------------------------------------------------------------
// Pantalla 2 — entrevista en vivo.
//
// Avatar con anillos cuando habla (TTS), pregunta grande centrada, botón mic
// gigante. Cuando hay transcript final, swap a la zona de "Confirmar y seguir".
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type {
  UseSpeechRecognitionResult,
  UseSpeechSynthesisResult,
} from '@/components/shared/voice';
import type { UseInterviewSessionResult } from '@/lib/api';

interface Props {
  session: UseInterviewSessionResult;
  candidateName: string;
  recognition: UseSpeechRecognitionResult;
  synthesis: UseSpeechSynthesisResult;
  finalTranscript: string;
  confirming: boolean;
  onMic: () => void;
  onRepeat: () => void;
  onRerecord: () => void;
  onConfirm: () => void;
}

export function LiveInterview({
  session,
  candidateName,
  recognition,
  synthesis,
  finalTranscript,
  confirming,
  onMic,
  onRepeat,
  onRerecord,
  onConfirm,
}: Props) {
  const { t } = useT();
  const { jobTitle, currentQuestion, answeredCount, totalQuestions } = session;
  const num = answeredCount + 1;
  const pct = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;
  const listening = recognition.isListening;
  const hasFinal = !!finalTranscript;

  return (
    <div className="iv-live">
      {/* Sub-header con rol, candidato, progreso. */}
      <div className="iv-live-head">
        <span className="iv-live-role">
          <Icon name="briefcase" size={13} />
          {jobTitle}
        </span>
        <span className="iv-live-sep">·</span>
        <span className="iv-live-cand">
          <Icon name="user-round" size={13} />
          {candidateName}
        </span>
        <span style={{ flex: 1 }} />
        <span className="iv-live-progress">
          {t('interview.live.progress', { n: num, total: totalQuestions })}
        </span>
        <div className="iv-progress-track">
          <div className="iv-progress-fill" style={{ width: pct + '%' }} />
        </div>
      </div>

      {/* Stage central: avatar + pregunta + voz. */}
      <div className="iv-stage">
        <Avatar speaking={synthesis.isSpeaking} />
        <div className="iv-ask-label">
          {synthesis.isSpeaking ? (
            <>
              <span className="iv-speaking-dot" />
              {t('interview.live.speaking')}
            </>
          ) : (
            t('interview.live.askLabel')
          )}
        </div>
        <h2 className="iv-question">
          {currentQuestion ? currentQuestion.text : ''}
        </h2>
        <button type="button" className="iv-repeat" onClick={onRepeat}>
          <Icon name="volume-2" size={15} />
          {t('interview.live.repeat')}
        </button>

        {!hasFinal ? (
          <div className="iv-voice-zone">
            <button
              type="button"
              className={`iv-mic${listening ? ' listening' : ''}`}
              onClick={onMic}
              disabled={!recognition.isSupported}
              aria-label={
                listening
                  ? t('interview.live.micStop')
                  : t('interview.live.micStart')
              }
            >
              <span className="iv-mic-rings" aria-hidden="true" />
              <Icon
                name={listening ? 'square' : 'mic'}
                size={listening ? 30 : 34}
                strokeWidth={listening ? 2.25 : 1.75}
              />
            </button>
            <div className="iv-mic-label">
              {!recognition.isSupported
                ? t('interview.live.micUnsupported')
                : listening
                  ? t('interview.live.micListening')
                  : t('interview.live.micHint')}
            </div>
            {listening && (
              <div className="iv-transcript live">
                <span className="iv-transcript-text">
                  {recognition.interimTranscript || '…'}
                </span>
                <span className="stream-cursor" />
              </div>
            )}
            {recognition.error && (
              <div className="iv-mic-error" role="alert">
                <Icon name="triangle-alert" size={11} /> {recognition.error}
              </div>
            )}
          </div>
        ) : (
          <div className="iv-confirm-zone">
            <div className="iv-transcript final">
              <div className="iv-transcript-kicker">
                <Icon name="check-check" size={12} strokeWidth={2.25} />
                {t('interview.live.transcriptHint')}
              </div>
              <p className="iv-transcript-text">{finalTranscript}</p>
            </div>
            <div className="iv-confirm-actions">
              <Button
                variant="secondary"
                icon="rotate-ccw"
                onClick={onRerecord}
                disabled={confirming}
              >
                {t('interview.live.rerecord')}
              </Button>
              <Button
                variant="primary"
                icon={confirming ? 'loader' : 'arrow-right'}
                onClick={onConfirm}
                disabled={confirming}
              >
                {confirming
                  ? t('interview.live.confirming')
                  : t('interview.live.confirm')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — círculo con anillos animados cuando el TTS está activo.
// ---------------------------------------------------------------------------

function Avatar({ speaking }: { speaking: boolean }) {
  return (
    <div className={`iv-avatar${speaking ? ' speaking' : ''}`}>
      <span className="iv-avatar-ring" aria-hidden="true" />
      <span className="iv-avatar-ring two" aria-hidden="true" />
      <Icon name="circle-user" size={46} strokeWidth={1.4} />
    </div>
  );
}
