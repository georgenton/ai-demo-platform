// -----------------------------------------------------------------------------
// Página debug del Demo 01 (RAG).
//
// Esta página NO es la UI final del demo — para eso llegarán los componentes
// de Claude Design. Es una herramienta de desarrollo para verificar end-to-end:
//
//   1) Que el ingest funciona (texto plano → indexado en pgvector).
//   2) Que el chat con streaming SSE llega al browser token por token.
//
// Cuando Jorge tenga las API keys reales (CHAT_API_KEY, EMBEDDINGS_API_KEY)
// y arranque `nx serve api` + `nx serve web`, esta página le da el feedback
// inmediato de que el pipeline completo (web → rewrites → NestJS → LLM)
// está vivo, sin esperar a la UI final.
//
// Estilos: inline mínimos para mantener la página autosuficiente. No vale
// la pena pulirla — es scratchpad, no producto.
// -----------------------------------------------------------------------------

'use client';

import { useState, type FormEvent } from 'react';

import { ApiError, ingestText, useChatStream } from '@/lib/api';

/** Demo al que apunta esta página. Hardcodeado porque es debug específico de RAG. */
const DEMO_ID = 'rag';

export default function DemoRagDebugPage() {
  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Demo 01 — RAG (debug)</h1>
      <p style={styles.note}>
        Página interna para verificar el pipeline end-to-end. La UI final del
        demo llega vía Claude Design.
      </p>

      <IngestSection />
      <ChatSection />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Ingest — sube texto plano al backend
// ---------------------------------------------------------------------------

function IngestSection() {
  const [name, setName] = useState('reglamento.txt');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'success'; documentId: string; chunkCount: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: 'loading' });

    try {
      const result = await ingestText({ name, content, demoId: DEMO_ID });
      setStatus({ kind: 'success', ...result });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.status} — ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Error desconocido';
      setStatus({ kind: 'error', message });
    }
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>1) Ingest (texto)</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Nombre del documento
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />
        </label>
        <label style={styles.label}>
          Contenido
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Pegá el texto de prueba aquí…"
            style={styles.textarea}
            rows={6}
            required
          />
        </label>
        <button
          type="submit"
          disabled={status.kind === 'loading'}
          style={styles.button}
        >
          {status.kind === 'loading' ? 'Indexando…' : 'Ingestar'}
        </button>
      </form>

      {status.kind === 'success' && (
        <p style={styles.success}>
          ✓ Indexado: documentId={status.documentId}, chunks={status.chunkCount}
        </p>
      )}
      {status.kind === 'error' && (
        <p style={styles.error}>Error: {status.message}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chat — pregunta + stream de tokens
// ---------------------------------------------------------------------------

function ChatSection() {
  const [question, setQuestion] = useState('');
  const { text, status, error, start, reset } = useChatStream();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    start({ q: question, demoId: DEMO_ID });
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>2) Chat (SSE streaming)</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Pregunta
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Cuál es el horario de matrícula?"
            style={styles.input}
            required
          />
        </label>
        <div style={styles.buttonRow}>
          <button
            type="submit"
            disabled={status === 'streaming'}
            style={styles.button}
          >
            {status === 'streaming' ? 'Streaming…' : 'Preguntar'}
          </button>
          <button type="button" onClick={reset} style={styles.buttonSecondary}>
            Reset
          </button>
        </div>
      </form>

      <p style={styles.statusLine}>
        Estado: <strong>{status}</strong>
      </p>

      {error && <p style={styles.error}>Error: {error}</p>}

      <pre style={styles.transcript}>{text || '(sin tokens todavía)'}</pre>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Estilos inline — mínimos, scratchpad
// ---------------------------------------------------------------------------

const styles = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, sans-serif',
    color: '#1f2937',
  },
  title: { fontSize: '1.75rem', margin: 0 },
  note: { color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' },
  section: {
    marginTop: '2rem',
    padding: '1rem',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  h2: { marginTop: 0, fontSize: '1.25rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.875rem',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: '1rem',
  },
  textarea: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  button: {
    padding: '0.5rem 1rem',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: '1rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  buttonSecondary: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    color: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: 4,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  buttonRow: { display: 'flex', gap: '0.5rem' },
  statusLine: { fontSize: '0.875rem', color: '#374151', marginTop: '0.75rem' },
  success: { color: '#047857', marginTop: '0.75rem' },
  error: { color: '#b91c1c', marginTop: '0.75rem' },
  transcript: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: '0.875rem',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    minHeight: '4rem',
  },
} satisfies Record<string, React.CSSProperties>;
