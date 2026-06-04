// -----------------------------------------------------------------------------
// Demo 07 — Avatar entrevistador HR (ADR-0017).
//
// Una página, tres pantallas (una por phase del hook `useInterviewSession`):
//   1. selección de rol + datos del candidato   (phase: idle / starting)
//   2. entrevista en vivo (avatar + mic gigante + transcripción)  (interviewing)
//      2b. cierre "Generar evaluación"           (ready_to_finalize)
//   3. resultado (dimensiones 1 a 1 + recomendación + banner auditoría)
//                                                (finalizing → finalized)
//
// Voz PURA: el candidato responde solo por mic. El avatar dice la pregunta
// por TTS. Banner de auditoría obligatorio en la pantalla de resultado
// (compromiso anti-bias del demo).
//
// Wiring (replaza los mocks del kit de Claude Design):
//   - getHrJobs              → useHrJobs (fetch on mount)
//   - useInterviewSessionMock → useInterviewSession (hook real con SSE)
//   - useSpeechSynthesisMock → useSpeechSynthesis ({ lang: 'es-ES' })
//   - useSpeechRecognitionMock + primeTranscript → useSpeechRecognition
//     ({ lang: 'es-ES' }). primeTranscript no existe en el real — la voz
//     del candidato llena `transcript` directamente.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useRef, useState } from 'react';

import { ErrorPanel } from '@/components/demo/interview/ErrorPanel';
import { LiveInterview } from '@/components/demo/interview/LiveInterview';
import { ReadyPanel } from '@/components/demo/interview/ReadyPanel';
import { ResultScreen } from '@/components/demo/interview/ResultScreen';
import { RoleSelect } from '@/components/demo/interview/RoleSelect';
import { useHrJobs } from '@/components/demo/interview/use-hr-jobs';
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from '@/components/shared/voice';
import { useInterviewSession } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function DemoInterviewPage() {
  const { lang } = useT();
  const session = useInterviewSession();
  // Voz nativa, español por defecto (el demo se presenta en es).
  // Si el header cambia a EN, recreamos para que el TTS lea en inglés.
  const speechLang = lang === 'en' ? 'en-US' : 'es-ES';
  const recognition = useSpeechRecognition({ lang: speechLang });
  const synthesis = useSpeechSynthesis({ lang: speechLang });

  const { items: jobs, loading: jobsLoading, error: jobsError } = useHrJobs();

  // -------------------------------------------------------------------------
  // Estado local de la página (no hook): selección, form y confirmación
  // -------------------------------------------------------------------------
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [cedula, setCedula] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Mide la duración del mic con `performance.now()` entre start/stop.
  // No es crítico para scoring pero queda en la base para auditoría.
  const micStartRef = useRef(0);

  const { phase, currentQuestion } = session;

  // Reset completo si el header cambia de idioma a media sesión, para
  // mantener coherencia de strings (mismo criterio que el clínico).
  // El primer render NO cuenta (langMountRef).
  const langMountRef = useRef(true);
  useEffect(() => {
    if (langMountRef.current) {
      langMountRef.current = false;
      return;
    }
    fullReset();
  }, [lang]);

  // Cuando llega o cambia la pregunta actual: el avatar la dice por TTS y
  // limpiamos el área de transcripción. El effect depende del id de la
  // pregunta — si Reusamos la misma id (no debería pasar), no relanzamos.
  useEffect(() => {
    if (phase === 'interviewing' && currentQuestion) {
      setFinalTranscript('');
      recognition.reset();
      synthesis.speak(currentQuestion.text);
    }
  }, [currentQuestion?.id, phase]);

  // Cuando el reconocedor entrega un transcript final, lo capturamos y
  // limpiamos el hook (mismo patrón que el clínico/tutor).
  useEffect(() => {
    if (recognition.transcript) {
      setFinalTranscript(recognition.transcript);
      recognition.reset();
    }
  }, [recognition.transcript]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function fullReset() {
    session.reset();
    recognition.reset();
    synthesis.cancel();
    setSelectedJobId(null);
    setCandidateName('');
    setCedula('');
    setFinalTranscript('');
    setConfirming(false);
  }

  async function handleStart() {
    if (!selectedJobId || !candidateName.trim()) return;
    synthesis.cancel();
    await session.start({
      jobId: selectedJobId,
      candidateName: candidateName.trim(),
      candidateExternalId: cedula.trim() || undefined,
    });
  }

  function handleMicClick() {
    if (recognition.isListening) {
      recognition.stop();
      return;
    }
    // Si ya hay transcript final, no abrimos el mic — el user debe usar
    // "Volver a grabar" para descartarlo y arrancar limpio.
    if (finalTranscript) return;
    // Cortamos el TTS si estaba sonando — no queremos que el mic capture
    // la voz del avatar.
    synthesis.cancel();
    micStartRef.current = performance.now();
    recognition.start();
  }

  function handleRepeat() {
    if (currentQuestion) synthesis.speak(currentQuestion.text);
  }

  function handleRerecord() {
    setFinalTranscript('');
    recognition.reset();
  }

  async function handleConfirm() {
    if (!finalTranscript || confirming) return;
    setConfirming(true);
    const durationSeconds = Math.max(
      1,
      Math.round((performance.now() - micStartRef.current) / 1000),
    );
    try {
      await session.submitAnswer({
        transcript: finalTranscript,
        durationSeconds,
      });
      setFinalTranscript('');
    } finally {
      setConfirming(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render por phase
  // -------------------------------------------------------------------------
  let body: React.ReactNode;
  if (phase === 'idle' || phase === 'starting') {
    body = (
      <RoleSelect
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelect={setSelectedJobId}
        candidateName={candidateName}
        setCandidateName={setCandidateName}
        cedula={cedula}
        setCedula={setCedula}
        onStart={handleStart}
        starting={phase === 'starting'}
        loading={jobsLoading}
        error={jobsError}
      />
    );
  } else if (phase === 'interviewing') {
    body = (
      <LiveInterview
        session={session}
        candidateName={candidateName}
        recognition={recognition}
        synthesis={synthesis}
        finalTranscript={finalTranscript}
        confirming={confirming}
        onMic={handleMicClick}
        onRepeat={handleRepeat}
        onRerecord={handleRerecord}
        onConfirm={handleConfirm}
      />
    );
  } else if (phase === 'ready_to_finalize') {
    body = (
      <ReadyPanel
        total={session.totalQuestions}
        onFinalize={session.finalize}
      />
    );
  } else if (phase === 'finalizing' || phase === 'finalized') {
    body = (
      <ResultScreen
        session={session}
        candidateName={candidateName}
        onRestart={fullReset}
      />
    );
  } else {
    body = <ErrorPanel message={session.error} onRestart={fullReset} />;
  }

  return <div className="iv-root">{body}</div>;
}
