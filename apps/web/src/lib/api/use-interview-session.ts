// -----------------------------------------------------------------------------
// useInterviewSession — hook que orquesta el flujo completo de una entrevista
// del Demo 07. Combina los 6 endpoints HR (REST + SSE) en una máquina de
// estados explícita.
//
// Por qué este hook y no llamar las funciones sueltas desde el componente:
//   - El flujo tiene varios estados ortogonales (pregunta actual, transcript
//     en grabación, scoring incremental) que se cruzan. Sin centralizar, la
//     página termina con 8-10 useState desordenados.
//   - El UI sólo necesita reaccionar a `phase` para decidir qué pantalla
//     mostrar; el detalle de cómo se llega a cada phase queda acá.
//   - Cuando el SSE del finalize está activo, el cleanup correcto al
//     desmontar el componente es responsabilidad del hook (no del usuario).
//
// Máquina de estados (transiciones VÁLIDAS):
//
//   idle ──start()──► starting ──┬─► interviewing ──submit()──► interviewing
//                                │         │
//                                │         └──submit() (todas resp.)──► ready_to_finalize
//                                │                                            │
//                                │                                       finalize()
//                                │                                            ▼
//                                ▼                                       finalizing ──SSE done──► finalized
//                              error                                            │
//                                                                          SSE error
//                                                                                ▼
//                                                                              error
//
// `reset()` puede llamarse desde CUALQUIER phase para volver a idle (corta
// el SSE activo si lo había).
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createHrInterview,
  getHrNextQuestion,
  recordHrAnswer,
  subscribeToHrFinalize,
} from './hr';
import { ApiError } from './client';
import type {
  HrAnswerRequest,
  HrCreateInterviewRequest,
  HrDimensionScored,
  HrFinalResult,
  HrFinalizeSubscription,
  HrQuestion,
} from './types-hr';

/**
 * Estados visibles del flujo. La UI usa este enum para decidir qué
 * pantalla pintar.
 */
export type InterviewPhase =
  | 'idle'
  | 'starting'
  | 'interviewing'
  | 'ready_to_finalize'
  | 'finalizing'
  | 'finalized'
  | 'error';

export interface UseInterviewSessionResult {
  /** Phase actual. */
  phase: InterviewPhase;
  /** Id de la entrevista activa (null si nunca arrancó). */
  interviewId: string | null;
  /** Título del rol (para mostrar en el header de la pantalla de entrevista). */
  jobTitle: string | null;
  /** Total de preguntas del rol (para el progreso "n/N"). */
  totalQuestions: number;
  /** Cuántas preguntas el candidato ya respondió + confirmó. */
  answeredCount: number;
  /** Pregunta actual a contestar; null si phase != 'interviewing'. */
  currentQuestion: HrQuestion | null;
  /**
   * Dimensiones que ya emitió el LLM durante el finalize. Se van
   * acumulando incrementalmente para que la UI las pinte una por una con
   * animación de entrada.
   */
  dimensions: HrDimensionScored[];
  /** Resultado final + recomendación; null hasta que llegue el evento `final`. */
  final: HrFinalResult | null;
  /** Mensaje legible si phase === 'error'. */
  error: string | null;

  /** Arranca una entrevista nueva. Resetea cualquier sesión previa. */
  start: (body: HrCreateInterviewRequest) => Promise<void>;
  /**
   * Persiste la respuesta del candidato y avanza. Si era la última pregunta,
   * el hook transiciona a `ready_to_finalize` y queda esperando que la UI
   * llame `finalize()`.
   */
  submitAnswer: (body: Omit<HrAnswerRequest, 'questionId'>) => Promise<void>;
  /** Dispara el SSE del scoring. Solo válido desde `ready_to_finalize`. */
  finalize: () => void;
  /** Cancela la sesión actual y vuelve a idle. Corta el SSE si estaba activo. */
  reset: () => void;
}

export function useInterviewSession(): UseInterviewSessionResult {
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<HrQuestion | null>(
    null,
  );
  const [dimensions, setDimensions] = useState<HrDimensionScored[]>([]);
  const [final, setFinal] = useState<HrFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs:
  //   - subscriptionRef: SSE activo del finalize.
  //   - abortRef: AbortController de la request HTTP en curso (start/submit).
  // Ambos cambian sin necesidad de re-render → ref.
  const subscriptionRef = useRef<HrFinalizeSubscription | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeStream = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    closeStream();
    abortInFlight();
    setPhase('idle');
    setInterviewId(null);
    setJobTitle(null);
    setTotalQuestions(0);
    setAnsweredCount(0);
    setCurrentQuestion(null);
    setDimensions([]);
    setFinal(null);
    setError(null);
  }, [closeStream, abortInFlight]);

  const start = useCallback(
    async (body: HrCreateInterviewRequest) => {
      // Reset suave: limpiamos pero no llamamos `reset()` porque eso pisaría
      // el phase a 'idle' antes de transicionar a 'starting'.
      closeStream();
      abortInFlight();
      setDimensions([]);
      setFinal(null);
      setError(null);
      setAnsweredCount(0);
      setPhase('starting');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await createHrInterview(body, controller.signal);
        if (controller.signal.aborted) return;
        setInterviewId(res.interviewId);
        setJobTitle(res.jobTitle);
        setTotalQuestions(res.totalQuestions);
        setCurrentQuestion(res.currentQuestion);
        setPhase('interviewing');
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(humanError(err));
        setPhase('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [closeStream, abortInFlight],
  );

  const submitAnswer = useCallback(
    async (body: Omit<HrAnswerRequest, 'questionId'>) => {
      if (!interviewId || !currentQuestion) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 1) Persistir la respuesta del candidato.
        await recordHrAnswer(
          interviewId,
          { questionId: currentQuestion.id, ...body },
          controller.signal,
        );
        if (controller.signal.aborted) return;

        // 2) Pedir la siguiente pregunta. Si done=true, transición a
        //    ready_to_finalize; si quedan, actualizar currentQuestion.
        const next = await getHrNextQuestion(interviewId, controller.signal);
        if (controller.signal.aborted) return;

        setAnsweredCount(next.answeredCount);

        if (next.done) {
          setCurrentQuestion(null);
          setPhase('ready_to_finalize');
        } else {
          setCurrentQuestion(next.currentQuestion);
          // Nos quedamos en 'interviewing' — la UI ya está en esa pantalla.
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(humanError(err));
        setPhase('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [interviewId, currentQuestion],
  );

  const finalize = useCallback(() => {
    if (!interviewId) return;
    closeStream();
    setDimensions([]);
    setFinal(null);
    setError(null);
    setPhase('finalizing');

    subscriptionRef.current = subscribeToHrFinalize(interviewId, {
      onEvent: (event) => {
        if (event.type === 'dimension_scored') {
          // Append a dimensions[]. Si el LLM repite una dimensión (raro),
          // nos quedamos con la última emisión — patrón "last write wins"
          // por `name`.
          setDimensions((prev) => {
            const idx = prev.findIndex((d) => d.name === event.name);
            const dim: HrDimensionScored = {
              name: event.name,
              score: event.score,
              evidence: event.evidence,
            };
            if (idx === -1) return [...prev, dim];
            const copy = [...prev];
            copy[idx] = dim;
            return copy;
          });
        } else if (event.type === 'final') {
          setFinal({
            overall: event.overall,
            recommendation: event.recommendation,
            strengths: event.strengths,
            opportunities: event.opportunities,
          });
        } else if (event.type === 'error_event') {
          setError(event.message);
          setPhase('error');
        }
        // 'token' y 'done' no impactan estado visible aquí; 'done' viene
        // por onDone separado.
      },
      onDone: () => {
        subscriptionRef.current = null;
        // Si llegó `final`, transicionamos a finalized. Si no (el LLM cortó
        // sin recomendación), el error ya está seteado o nos quedamos en
        // finalized con el resultado parcial — la UI puede mostrar lo que hay.
        setPhase((prev) => (prev === 'error' ? 'error' : 'finalized'));
      },
      onError: (err) => {
        setError(err.message);
        setPhase('error');
        subscriptionRef.current = null;
      },
    });
  }, [interviewId, closeStream]);

  // Cleanup al desmontar — cerrar SSE + cancelar requests pendientes.
  useEffect(() => {
    return () => {
      closeStream();
      abortInFlight();
    };
  }, [closeStream, abortInFlight]);

  return {
    phase,
    interviewId,
    jobTitle,
    totalQuestions,
    answeredCount,
    currentQuestion,
    dimensions,
    final,
    error,
    start,
    submitAnswer,
    finalize,
    reset,
  };
}

/** Convierte un error de fetch/API en un string legible para mostrar. */
function humanError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
