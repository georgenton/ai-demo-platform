// -----------------------------------------------------------------------------
// Demo 01 — RAG: Chat con documentos.
//
// Layout (kit):
//   - Page header con eyebrow, title, subtitle y CTA "Subir documento".
//   - Two-col: sidebar de documentos a la izquierda, chat shell a la derecha.
//
// Wiring:
//   - Documents: useDocuments({ demoId: 'rag' }) que envuelve listDocuments
//     + deleteDocument + refresh.
//   - Chat: useChatStream() de @/lib/api. Mantenemos histórico de messages
//     en estado local; durante streaming pintamos un mensaje "vivo"
//     adicional cuyo texto viene del hook.
//
// Decisiones:
//   - Greeting inicial del assistant viene de i18n (t('rag.greeting')).
//   - 3 sugerencias clickeables debajo del composer — pone la sugerencia
//     en el input pero NO la dispara automáticamente (el usuario decide).
//   - Autoscroll: useRef + useEffect que scrollea al fondo cuando cambia
//     la cantidad de mensajes o el texto del stream.
//   - Citas: la burbuja del assistant parsea [[...]] como spans
//     citation-inline. Si el LLM no emite ese formato, queda texto plano.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Eyebrow, Icon, Modal, Pill } from '@/components/ui';
import { Bubble } from '@/components/demo/rag/Bubble';
import { DocCard } from '@/components/demo/rag/DocCard';
import { ThinkingBubble } from '@/components/demo/rag/ThinkingBubble';
import { UploadPanel } from '@/components/demo/rag/UploadPanel';
import { useDocuments } from '@/components/demo/rag/use-documents';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import { LlmProviderWarning } from '@/components/shared/LlmProviderWarning';
import {
  useEstimatedCost,
  useTextDelta,
} from '@/components/shared/use-estimated-cost';
import { useChatStream } from '@/lib/api';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';
import { useLlmProvider } from '@/lib/llm';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const DEMO_ID = 'rag' as const;

export default function DemoRagPage() {
  const { t, lang } = useT();
  // Provider activo (dropdown del header). Histórico: Anthropic bloqueaba
  // RAG porque no tiene embeddings. Decisión renovada Q2 2026: el backend
  // cae al EMBEDDINGS_PROVIDER del env (OpenAI cloud) cuando chat=Anthropic,
  // así que RAG ahora funciona en los 3 providers. El bloqueo queda
  // siempre `false`; se mantiene la variable por si vuelve a aparecer un
  // provider sin embeddings y queremos reactivar el banner.
  const { provider } = useLlmProvider();
  void provider;
  const ragBlocked = false;

  // Documents
  const {
    documents,
    status: docsStatus,
    refresh,
    remove,
  } = useDocuments(DEMO_ID);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // El primer doc disponible queda seleccionado por defecto.
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);

  // Chat
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const {
    text: streamText,
    status: chatStatus,
    error: chatError,
    start,
  } = useChatStream();

  // Greeting inicial — reemplaza el history cuando cambia el idioma.
  useEffect(() => {
    setHistory([{ role: 'assistant', text: t('rag.greeting') }]);
  }, [lang, t]);

  // Cuando un stream termina (done) o falla (error), movemos el texto
  // streameado al history y dejamos `streamText` libre para el próximo
  // turn. `prevStatus` evita procesar el mismo done dos veces.
  const prevStatus = useRef(chatStatus);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = chatStatus;
    if (was === 'streaming' && chatStatus === 'done' && streamText) {
      setHistory((h) => [...h, { role: 'assistant', text: streamText }]);
    } else if (was === 'streaming' && chatStatus === 'error') {
      const msg = chatError ?? 'Error desconocido';
      setHistory((h) => [...h, { role: 'assistant', text: `Error: ${msg}` }]);
    }
  }, [chatStatus, streamText, chatError]);

  // Autoscroll al fondo del stream cada vez que cambia el contenido.
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  });

  // Mensajes que se pintan en pantalla: history + (si está streameando)
  // una burbuja viva con el texto en curso.
  const displayMessages = useMemo<
    Array<ChatMessage & { streaming?: boolean }>
  >(() => {
    if (chatStatus === 'streaming' && streamText) {
      return [
        ...history,
        { role: 'assistant', text: streamText, streaming: true },
      ];
    }
    return history;
  }, [history, chatStatus, streamText]);

  // Cost mini widget — pricing del backend + acumulación estimada local.
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  useTextDelta(streamText, cost.addOutput);
  const audience = getDemoAudience(DEMO_ID, t);

  function send() {
    const q = input.trim();
    // Defensive: el composer ya está disabled en estos casos, pero por si
    // alguien hace Enter desde la consola o el state se desincroniza.
    if (!q || chatStatus === 'streaming' || ragBlocked) return;
    cost.addInput(q);
    setInput('');
    setHistory((h) => [...h, { role: 'user', text: q }]);
    start({ q, demoId: DEMO_ID });
  }

  const suggested = [
    t('rag.suggested.1'),
    t('rag.suggested.2'),
    t('rag.suggested.3'),
  ];

  const isStreaming = chatStatus === 'streaming';
  const showThinking = isStreaming && !streamText;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('rag.eyebrow')}</div>
          <h1 className="page-title">{t('rag.title')}</h1>
          <p className="page-subtitle">{t('rag.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
          <Button
            variant="primary"
            icon="upload"
            size="lg"
            onClick={() => setUploadOpen(true)}
            disabled={ragBlocked}
            title={ragBlocked ? t('rag.upload.disabled') : undefined}
          >
            {t('rag.upload')}
          </Button>
        </div>
      </div>

      {ragBlocked && <LlmProviderWarning />}

      <div className="two-col">
        <aside className="two-col-side">
          <Eyebrow>
            {t('rag.docs.label')} · {documents.length}
          </Eyebrow>
          <div
            className="scroll-area"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flex: 1,
            }}
          >
            {docsStatus === 'loading' && documents.length === 0 ? (
              <DocsLoading />
            ) : documents.length === 0 ? (
              <div
                role="button"
                tabIndex={0}
                className="drag-zone"
                onClick={() => setUploadOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setUploadOpen(true);
                  }
                }}
              >
                <Icon name="upload-cloud" size={28} strokeWidth={1.4} />
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  {t('rag.docs.empty')}
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  selected={doc.id === selectedDocId}
                  onSelect={() => setSelectedDocId(doc.id)}
                  onDelete={() => remove(doc.id)}
                />
              ))
            )}
          </div>
        </aside>

        <main className="two-col-main">
          <div className="chat-shell">
            <div className="chat-stream" ref={streamRef}>
              <div className="chat-stream-header-fade" aria-hidden />
              {displayMessages.map((message, i) => (
                <Bubble
                  key={i}
                  role={message.role}
                  text={message.text}
                  streaming={message.streaming}
                />
              ))}
              {showThinking && <ThinkingBubble label={t('rag.thinking')} />}
            </div>

            <div className="chat-composer">
              <div className="chat-composer-inner">
                <textarea
                  className="chat-composer-input"
                  placeholder={t('rag.composer.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  disabled={isStreaming || ragBlocked}
                  title={ragBlocked ? t('rag.upload.disabled') : undefined}
                />
                <button
                  type="button"
                  className="send-btn"
                  onClick={send}
                  disabled={!input.trim() || isStreaming || ragBlocked}
                  aria-label={t('common.send')}
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
                {suggested.map((q) => (
                  <Pill key={q} icon="sparkles" onClick={() => setInput(q)}>
                    {q}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t('rag.upload.title')}
      >
        <UploadPanel
          demoId={DEMO_ID}
          onSuccess={(response) => {
            setUploadOpen(false);
            refresh();
            setSelectedDocId(response.documentId);
          }}
        />
      </Modal>
    </div>
  );
}

/**
 * Skeleton de la lista de documentos. Tres cards-gris animadas mientras
 * `listDocuments` está en vuelo. Usamos la clase .skeleton del ui-kit (1.6s
 * shimmer loop) — mucho mejor UX que un spinner solitario.
 */
function DocsLoading() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 64, borderRadius: 10 }}
        />
      ))}
    </>
  );
}
