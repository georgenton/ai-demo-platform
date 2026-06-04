// -----------------------------------------------------------------------------
// Demo 06 — Asistente clínico (ADR-0016).
//
// Layout (kit): 3 paneles + banner permanente arriba.
//
//   [ banner sintético — siempre visible ]
//   [ pacientes | historia clínica | asistente ]
//
// Wiring (replaza los mocks del kit de Claude Design):
//   - getClinicalPatients via usePatientList (con debounce 300ms).
//   - getClinicalPatientDetail via usePatientDetail (con AbortController).
//   - subscribeToClinicalAnalyze via useClinicalAnalyze (entries[] tipado).
//
// La pregunta del médico (`question`) NO viene del SSE — la sumamos como
// entry local antes de llamar a start() y la timeline visual la concatena
// adelante de las entries que vuelven del hook.
//
// Cada pregunta es independiente (sin multi-turn) — coincide con el backend.
// La voz nativa es un placeholder deshabilitado; entra en PR siguiente.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge, EmptyState, Icon } from '@/components/ui';
import {
  ClinicalEntry,
  ThinkingRow,
} from '@/components/demo/clinical/ClinicalEntry';
import type { ClinicalTimelineEntry } from '@/components/demo/clinical/ClinicalEntry';
import { ClinicalHistory } from '@/components/demo/clinical/ClinicalHistory';
import { PatientCard } from '@/components/demo/clinical/PatientCard';
import { usePatientDetail } from '@/components/demo/clinical/use-patient-detail';
import { usePatientList } from '@/components/demo/clinical/use-patient-list';
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from '@/components/shared/voice';
import { useClinicalAnalyze } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function DemoClinicalPage() {
  const { t, lang } = useT();

  // Panel izquierdo: búsqueda libre del médico.
  const [searchQuery, setSearchQuery] = useState('');
  const {
    items: patients,
    total,
    error: listError,
  } = usePatientList(searchQuery);

  // Selección de paciente — dispara fetch del detalle (panel central) y
  // resetea la conversación (panel derecho).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { patient, error: detailError } = usePatientDetail(selectedId);

  // Panel derecho: input + hook del SSE.
  const [input, setInput] = useState('');
  const [questionText, setQuestionText] = useState<string | null>(null);
  const { entries, status, start, reset } = useClinicalAnalyze();

  const running = status === 'streaming';

  // -------------------------------------------------------------------------
  // Voz nativa (ADR-0016 decisión 2B). Reusa los hooks compartidos del
  // tutor (Demo 05). Lang: 'es-ES' porque el demo se presenta en español.
  // El médico dicta la pregunta, opcionalmente el asistente le lee la
  // respuesta de vuelta (toggle).
  // -------------------------------------------------------------------------
  const recognition = useSpeechRecognition({ lang: 'es-ES' });
  const synthesis = useSpeechSynthesis({ lang: 'es-ES' });
  const [autoSpeak, setAutoSpeak] = useState(false);
  // Detectamos transición running → done para disparar el TTS sobre la
  // respuesta del LLM. Sin este ref, leeríamos la respuesta cada vez que
  // entries cambia (= cada token).
  const wasRunningRef = useRef(false);

  // Autoscroll del panel del asistente cuando llegan tokens nuevos.
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streamRef.current)
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
  });

  // Si el médico cambia el idioma, limpiamos la conversación para que las
  // strings i18n queden coherentes con lo que se sigue mostrando.
  useEffect(() => {
    reset();
    setQuestionText(null);
    setInput('');
    synthesis.cancel();
  }, [lang, reset, synthesis]);

  // Cuando el reconocedor devuelve un transcript final, lo movemos al input
  // y reseteamos el hook para que el próximo start() arranque limpio. Mismo
  // patrón del tutor — el usuario puede editar antes de enviar.
  useEffect(() => {
    if (recognition.transcript) {
      setInput((prev) =>
        prev ? prev + ' ' + recognition.transcript : recognition.transcript,
      );
      recognition.reset();
    }
  }, [recognition.transcript, recognition]);

  // Auto-speak: cuando el stream pasa de 'streaming' a 'done', concatenamos
  // todos los entries de texto del LLM (sin las cards de tool) y los leemos.
  // Solo si autoSpeak está activo y TTS soportado.
  useEffect(() => {
    const justFinished = wasRunningRef.current && !running && status === 'done';
    if (justFinished && autoSpeak && synthesis.isSupported) {
      // El hook ya compacta los token deltas en una sola entry `kind: 'text'`
      // por burbuja del LLM. Concatenamos esas entries y dejamos afuera las
      // cards de tool (que no tienen sentido leerlas en voz alta).
      const fullAnswer = entries
        .filter((e): e is { kind: 'text'; text: string } => e.kind === 'text')
        .map((e) => e.text)
        .join(' ')
        .trim();
      if (fullAnswer) synthesis.speak(fullAnswer);
    }
    wasRunningRef.current = running;
  }, [running, status, autoSpeak, synthesis, entries]);

  // Cambio de paciente: cortar el stream activo y limpiar la timeline.
  function selectPatient(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    reset();
    setQuestionText(null);
    setInput('');
    // Si el TTS estaba leyendo la respuesta del paciente anterior, corte limpio.
    synthesis.cancel();
  }

  function ask(rawText: string) {
    const text = rawText.trim();
    if (!text || !patient || running) return;
    // Si el médico envía mientras el mic estaba activo, lo apagamos primero
    // — no queremos que siga grabando con el input vacío.
    if (recognition.isListening) recognition.stop();
    // Si había TTS sonando de la respuesta anterior, lo cortamos.
    synthesis.cancel();
    setInput('');
    setQuestionText(text);
    start({ patientId: patient.id, question: text });
  }

  function handleMicToggle() {
    if (recognition.isListening) {
      recognition.stop();
    } else {
      // Si el asistente estaba hablando, cortamos — no queremos que el mic
      // capture el TTS en loop.
      synthesis.cancel();
      recognition.start();
    }
  }

  function handleAutoSpeakToggle() {
    setAutoSpeak((on) => {
      if (on) synthesis.cancel();
      return !on;
    });
  }

  // Timeline visual: la pregunta local + las entries que vienen del hook.
  // El kit unifica ambas como ClinicalTimelineEntry para que el render sea
  // un solo .map().
  const timeline: ClinicalTimelineEntry[] = useMemo(() => {
    if (!questionText) return [];
    return [{ kind: 'question', text: questionText }, ...entries];
  }, [questionText, entries]);

  const counterKey = total === 1 ? 'clinical.counter.one' : 'clinical.counter';

  // "Pensando…" solo mientras el LLM está razonando ANTES de tirar texto.
  // Lo mostramos si la última entrada es la pregunta (LLM aún no empezó) o
  // un tool_result (LLM cerró el ciclo del tool, está por seguir hablando).
  const last = timeline[timeline.length - 1];
  const showThinking =
    running &&
    last &&
    (last.kind === 'question' || last.kind === 'tool_result');

  // Sugerencias localizadas. Cada string vive en su propia key del i18n
  // (`clinical.suggest.1` … `.4`) — mismo patrón que rag.suggested.1/.2/.3.
  // El frontend mapea sobre el array de claves para no acoplarse al número.
  const suggestions = [
    t('clinical.suggest.1'),
    t('clinical.suggest.2'),
    t('clinical.suggest.3'),
    t('clinical.suggest.4'),
  ];

  return (
    <div className="clinical-root">
      {/* Banner permanente de datos sintéticos */}
      <div className="clinical-banner" role="note">
        <Icon name="triangle-alert" size={14} />
        <span>
          <strong>{t('clinical.banner.title')}</strong>
        </span>
        <span className="clinical-banner-text">
          · {t('clinical.banner.text')}
        </span>
      </div>

      <div className="clinical-head">
        <span className="clinical-head-eyebrow">{t('clinical.eyebrow')}</span>
        <span className="clinical-head-title">{t('clinical.title')}</span>
        <span className="clinical-head-sub">{t('clinical.tagline')}</span>
      </div>

      <div className="clinical-grid">
        {/* ---- PANEL IZQUIERDO: lista de pacientes ---- */}
        <section className="clinical-panel">
          <div className="clinical-panel-head">
            <Icon
              name="users"
              size={14}
              style={{ color: 'var(--color-fg-muted)' }}
            />
            <span className="label">{t('clinical.panel.patients')}</span>
            <span style={{ flex: 1 }} />
            <Badge tone="neutral" mono>
              {t(counterKey, { n: total })}
            </Badge>
          </div>
          <div className="patient-search">
            <div style={{ position: 'relative' }}>
              <Icon
                name="search"
                size={15}
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-fg-subtle)',
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 34 }}
                placeholder={t('clinical.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="clinical-panel-body">
            {listError ? (
              <div className="clinical-panel-error">{listError}</div>
            ) : patients.length === 0 ? (
              <div className="clinical-panel-empty">
                {t('clinical.search.empty')}
              </div>
            ) : (
              <div className="patient-list">
                {patients.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    selected={p.id === selectedId}
                    onSelect={() => selectPatient(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---- PANEL CENTRAL: historia clínica ---- */}
        <section className="clinical-panel">
          <div className="clinical-panel-head">
            <Icon
              name="clipboard-list"
              size={14}
              style={{ color: 'var(--color-fg-muted)' }}
            />
            <span className="label">{t('clinical.panel.history')}</span>
          </div>
          <div className="clinical-panel-body">
            {detailError ? (
              <div className="clinical-panel-error">{detailError}</div>
            ) : (
              <ClinicalHistory patient={patient} />
            )}
          </div>
        </section>

        {/* ---- PANEL DERECHO: asistente ---- */}
        <section className="clinical-panel">
          <div className="clinical-panel-head">
            <Icon
              name="stethoscope"
              size={14}
              style={{ color: 'var(--nai-mint-600)' }}
            />
            <span className="label">{t('clinical.panel.assistant')}</span>
          </div>

          <div
            className="clinical-panel-body"
            ref={streamRef}
            style={{ padding: 16 }}
          >
            {!patient ? (
              <EmptyState
                icon="stethoscope"
                title={t('clinical.empty.assistant')}
                body=""
              />
            ) : timeline.length === 0 ? (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div className="clin-section-label" style={{ marginBottom: 2 }}>
                  {t('clinical.suggest.title')}
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="clin-suggest"
                    onClick={() => ask(s)}
                    disabled={running}
                  >
                    <Icon
                      name="sparkles"
                      size={14}
                      style={{
                        color: 'var(--color-accent)',
                        marginTop: 1,
                        flexShrink: 0,
                      }}
                    />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {timeline.map((entry, i) => (
                  <ClinicalEntry
                    key={i}
                    entry={entry}
                    pending={running && i === timeline.length - 1}
                  />
                ))}
                {showThinking && (
                  <ThinkingRow label={t('clinical.status.thinking')} />
                )}
              </div>
            )}
          </div>

          {/* Toggle del TTS — sólo se muestra si el browser lo soporta y hay
              paciente seleccionado. Útil para uso manos-libres del médico
              entre paciente y paciente. */}
          {patient && synthesis.isSupported && (
            <div className="clinical-voice-bar">
              <button
                type="button"
                className={`clinical-voice-toggle${autoSpeak ? ' on' : ''}`}
                onClick={handleAutoSpeakToggle}
                title={t('clinical.voice.autoSpeak.tip')}
                aria-pressed={autoSpeak}
              >
                <Icon name={autoSpeak ? 'volume-2' : 'volume-x'} size={13} />
                <span>{t('clinical.voice.autoSpeak.label')}</span>
              </button>
              {synthesis.isSpeaking && (
                <button
                  type="button"
                  className="clinical-voice-stop"
                  onClick={() => synthesis.cancel()}
                  title={t('clinical.voice.stopSpeaking')}
                >
                  <Icon name="square" size={11} strokeWidth={2.5} />
                  <span>{t('clinical.voice.speaking')}</span>
                </button>
              )}
            </div>
          )}

          <div className="chat-composer">
            <div className="chat-composer-inner">
              <textarea
                className="chat-composer-input"
                placeholder={
                  recognition.isListening && recognition.interimTranscript
                    ? recognition.interimTranscript
                    : t('clinical.input.placeholder')
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={1}
                disabled={!patient}
              />
              {/* Voz: si el browser no soporta SpeechRecognition (Firefox,
                  Safari iOS), el botón queda deshabilitado con tooltip. Si
                  soporta, alterna entre idle → listening → idle. */}
              <button
                type="button"
                className={`voice-btn${recognition.isListening ? ' active' : ''}`}
                disabled={!patient || !recognition.isSupported}
                onClick={handleMicToggle}
                title={
                  !recognition.isSupported
                    ? t('clinical.voice.unsupported')
                    : recognition.isListening
                      ? t('clinical.voice.mic.stop')
                      : t('clinical.voice.mic.start')
                }
                aria-pressed={recognition.isListening}
                aria-label={
                  recognition.isListening
                    ? t('clinical.voice.mic.stop')
                    : t('clinical.voice.mic.start')
                }
              >
                <Icon
                  name={recognition.isListening ? 'mic' : 'mic'}
                  size={16}
                />
              </button>
              <button
                type="button"
                className="send-btn"
                onClick={() => ask(input)}
                disabled={!patient || !input.trim() || running}
                aria-label={t('common.send')}
              >
                <Icon
                  name={running ? 'square' : 'arrow-up'}
                  size={16}
                  strokeWidth={2}
                />
              </button>
            </div>
            {recognition.error && (
              <div className="clinical-voice-error" role="alert">
                <Icon name="triangle-alert" size={11} /> {recognition.error}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
