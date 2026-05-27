// =============================================================================
// ui_kits/web/DemoRag.jsx — Demo 01: Chat with documents. Lang-aware.
// =============================================================================

function DemoRag() {
  const { t, lang } = useT();
  const initialDocs = useMemo(() => buildSampleDocsRag(t), [lang]);
  const [docs, setDocs] = useState(initialDocs);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(initialDocs[0]?.id);
  const [messages, setMessages] = useState([{ role: 'assistant', text: t('rag.greeting'), done: true }]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const streamRef = useRef(null);

  // Refresh docs + greeting on language change
  useEffect(() => {
    setDocs(buildSampleDocsRag(t));
    setMessages([{ role: 'assistant', text: t('rag.greeting'), done: true }]);
  }, [lang]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  });

  function send() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setStreaming(true);
    setTimeout(() => {
      const fullText = pickFakeAnswer(q, lang);
      setMessages((m) => [...m, { role: 'assistant', text: '', done: false, _full: fullText }]);
    }, 220);
  }

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.done || last.role !== 'assistant' || !last._full) return;
    const target = last._full;
    let i = last.text.length;
    const id = setInterval(() => {
      i += 2;
      const next = target.slice(0, i);
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { ...last, text: next, done: i >= target.length };
        return copy;
      });
      if (i >= target.length) {
        clearInterval(id);
        setStreaming(false);
      }
    }, 22);
    return () => clearInterval(id);
  }, [messages.length, messages[messages.length - 1]?._full]);

  function handleUploaded(name) {
    const newDoc = {
      id: 'd' + Math.random().toString(36).slice(2, 7),
      name,
      chunkCount: Math.floor(Math.random() * 60) + 12,
      createdAt: new Date().toISOString(),
      size: (Math.random() * 3 + 0.4).toFixed(1) + ' MB',
    };
    setDocs((d) => [newDoc, ...d]);
    setUploadOpen(false);
    setSelectedDocId(newDoc.id);
  }

  function deleteDoc(id) { setDocs((d) => d.filter((x) => x.id !== id)); }

  const suggested = [t('rag.suggested.1'), t('rag.suggested.2'), t('rag.suggested.3')];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('rag.eyebrow')}</div>
          <h1 className="page-title">{t('rag.title')}</h1>
          <p className="page-subtitle">{t('rag.subtitle')}</p>
        </div>
        <Button variant="primary" icon="upload" size="lg" onClick={() => setUploadOpen(true)}>{t('rag.upload')}</Button>
      </div>

      <div className="two-col">
        <aside className="two-col-side">
          <Eyebrow>{t('rag.docs.label')} · {docs.length}</Eyebrow>
          <div className="scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {docs.length === 0 ? (
              <div className="drag-zone" onClick={() => setUploadOpen(true)}>
                <Icon name="upload-cloud" size={28} strokeWidth={1.4} />
                <p style={{ fontSize: 13, marginTop: 8 }}>{t('rag.docs.empty')}</p>
              </div>
            ) : (
              docs.map((doc) => (
                <DocCard key={doc.id} doc={doc} selected={doc.id === selectedDocId} onSelect={() => setSelectedDocId(doc.id)} onDelete={() => deleteDoc(doc.id)} t={t} lang={lang} />
              ))
            )}
          </div>
        </aside>

        <main className="two-col-main">
          <div className="chat-shell">
            <div className="chat-stream" ref={streamRef}>
              <div className="chat-stream-header-fade"></div>
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} done={m.done !== false} />
              ))}
              {streaming && messages[messages.length - 1]?.role === 'user' && (
                <ThinkingBubble label={t('rag.thinking')} />
              )}
            </div>

            <div className="chat-composer">
              <div className="chat-composer-inner">
                <textarea
                  className="chat-composer-input"
                  placeholder={t('rag.composer.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                />
                <button className="send-btn" onClick={send} disabled={!input.trim() || streaming} aria-label={t('common.send')}>
                  <Icon name={streaming ? 'square' : 'arrow-up'} size={16} strokeWidth={2} />
                </button>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggested.map((q) => (
                  <Pill key={q} icon="sparkles" onClick={() => setInput(q)}>{q}</Pill>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={t('rag.upload.title')}>
        <UploadPanel onUploaded={handleUploaded} t={t} />
      </Modal>
    </div>
  );
}

function DocCard({ doc, selected, onSelect, onDelete, t, lang }) {
  return (
    <div className={'doc-card ' + (selected ? 'selected' : '')} onClick={onSelect}>
      <div className="doc-icon">PDF</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
        <div className="doc-meta">
          <span>{doc.chunkCount} {t('rag.doc.fragments')}</span>
          <span className="dot"></span>
          <span>{doc.size}</span>
          <span className="dot"></span>
          <span>{formatRelative(doc.createdAt, lang)}</span>
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="theme-toggle" style={{ width: 26, height: 26, border: 0 }} aria-label={t('rag.delete')}>
        <Icon name="trash-2" size={13} />
      </button>
    </div>
  );
}

function Bubble({ role, text, done }) {
  if (role === 'user') {
    return (
      <div className="bubble-row user">
        <div className="bubble user">{text}</div>
      </div>
    );
  }
  return (
    <div className="bubble-row assistant">
      <div className="avatar">AI</div>
      <div className="bubble assistant">
        <span dangerouslySetInnerHTML={{ __html: renderCitations(text) }}></span>
        {!done && <span className="stream-cursor"></span>}
      </div>
    </div>
  );
}

function ThinkingBubble({ label }) {
  return (
    <div className="bubble-row assistant materialize">
      <div className="avatar">AI</div>
      <div className="bubble assistant" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <ThinkingDots />
        <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>{label}</span>
      </div>
    </div>
  );
}

function UploadPanel({ onUploaded, t }) {
  const [name, setName] = useState(t('sample.doc.reglamento'));
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="drag-zone" onClick={() => onUploaded(name)}>
        <Icon name="upload-cloud" size={32} strokeWidth={1.4} />
        <p style={{ fontSize: 14, marginTop: 10, color: 'var(--color-fg)' }}>{t('rag.upload.drop')}</p>
        <p style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginTop: 4 }}>{t('rag.upload.limits')}</p>
      </div>
      <div className="col">
        <label className="eyebrow">{t('rag.upload.or')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rag.upload.namePlaceholder')} />
        <textarea className="input textarea" placeholder={t('rag.upload.contentPlaceholder')} rows={4}></textarea>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="primary" icon="upload" onClick={() => onUploaded(name)}>{t('rag.upload.submit')}</Button>
      </div>
    </div>
  );
}

function renderCitations(text) {
  return text
    .replace(/\[\[(.+?)\]\]/g, '<span class="citation-inline">$1</span>')
    .replace(/\n/g, '<br>');
}

// -- Fake answers (per language) -------------------------------------------
const FAKE_ANSWERS = {
  es: {
    matricula: 'El período ordinario de matrícula se extiende del 5 al 20 de marzo, según el [[Reglamento académico, art. 14]]. Pasado ese plazo, los estudiantes pueden solicitar matrícula extraordinaria por hasta 5 días hábiles, con un recargo del 15% sobre el valor del crédito [[art. 15]]. La matrícula extraordinaria requiere autorización del Vicerrectorado Académico [[Manual de matrículas, sección 3.2]].',
    recalifica: 'Una recalificación puede solicitarse dentro de los 5 días hábiles siguientes a la publicación de notas, llenando el formulario en la Secretaría Académica [[Reglamento académico, art. 41]]. El docente tiene un plazo de 10 días para responder con sustento; si el estudiante no queda conforme, puede apelar ante el Consejo de Carrera dentro de 3 días adicionales.',
    propiedad: 'Toda obra intelectual producida en el marco de actividades académicas o de investigación pertenece a la Universidad y al autor de forma compartida [[Política de propiedad intelectual, art. 7]]. El autor conserva los derechos morales; la Universidad recibe una licencia no exclusiva para usos académicos y de difusión.',
    default: 'Encontré 4 fragmentos relevantes en el documento. La regla principal está en el [[Reglamento académico, art. 23]], que establece los criterios. Si querés que profundice en algún aspecto específico, decime cuál y armo un resumen más detallado.',
  },
  en: {
    matricula: 'The regular enrollment period runs from March 5 to March 20, per the [[Academic policy, art. 14]]. After that window, students may request late enrollment for up to 5 business days, with a 15% surcharge on the credit price [[art. 15]]. Late enrollment requires authorization from the Provost Office [[Enrollment manual, section 3.2]].',
    recalifica: 'A grade review can be requested within 5 business days after grades are published, by filling the form at the Registrar Office [[Academic policy, art. 41]]. The instructor has 10 days to respond with justification; if the student is not satisfied, they may appeal to the Program Council within 3 additional days.',
    propiedad: 'Any intellectual work produced as part of academic or research activities belongs jointly to the University and the author [[IP policy, art. 7]]. The author retains moral rights; the University receives a non-exclusive license for academic and outreach uses.',
    default: 'I found 4 relevant fragments in the document. The main rule is in [[Academic policy, art. 23]], which sets the criteria. If you want me to go deeper on a specific point, tell me which and I will put together a more detailed summary.',
  },
};

function pickFakeAnswer(q, lang) {
  const norm = q.toLowerCase();
  const set = FAKE_ANSWERS[lang] || FAKE_ANSWERS.es;
  if (norm.includes('matrícula') || norm.includes('matricula') || norm.includes('horario') || norm.includes('enrollment')) return set.matricula;
  if (norm.includes('recalifica') || norm.includes('review') || norm.includes('grade')) return set.recalifica;
  if (norm.includes('propiedad intelectual') || norm.includes('autor') || norm.includes('intellectual') || norm.includes('ip')) return set.propiedad;
  return set.default;
}

window.DemoRag = DemoRag;
