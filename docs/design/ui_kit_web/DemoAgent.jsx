// =============================================================================
// ui_kits/web/DemoAgent.jsx — Demo 04: SQL agent with structured data. Lang-aware.
// =============================================================================

function DemoAgent() {
  const { t, lang } = useT();
  const [tab, setTab] = useState('console');
  const [input, setInput] = useState('');
  const [events, setEvents] = useState([]);
  const [running, setRunning] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  });

  // Clear events on language change so the user sees fresh translated strings
  useEffect(() => { setEvents([]); }, [lang]);

  function ask(q) {
    if (running) return;
    setInput('');
    setEvents([{ kind: 'question', text: q }]);
    setRunning(true);
    runAgentSimulation(q, lang, t, (event) => {
      setEvents((evs) => [...evs, event]);
    }, () => setRunning(false));
  }

  const questions = window.SUGGESTED_QUESTIONS_I18N[lang] || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('agent.eyebrow')}</div>
          <h1 className="page-title">{t('agent.title')}</h1>
          <p className="page-subtitle">{t('agent.subtitle')}</p>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab ' + (tab === 'console' ? 'active' : '')} onClick={() => setTab('console')}>{t('agent.tab.console')}</button>
        <button className={'tab ' + (tab === 'history' ? 'active' : '')} onClick={() => setTab('history')}>{t('agent.tab.history')}</button>
      </div>

      {tab === 'console' ? (
        <div className="three-col">
          {/* LEFT — questions */}
          <aside className="col" style={{ gap: 14, minHeight: 0 }}>
            <Eyebrow>{t('agent.suggested')}</Eyebrow>
            <div className="col" style={{ gap: 6 }}>
              {questions.map((q) => (
                <button key={q} className="card card-hover" style={{ textAlign: 'left', font: 'inherit', color: 'var(--color-fg)', padding: '10px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.45 }} onClick={() => ask(q)} disabled={running}>
                  <Icon name="sparkles" size={13} style={{ color: 'var(--color-accent)', marginTop: 2, flexShrink: 0 }} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* CENTER — stream */}
          <main className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0, overflow: 'hidden' }}>
            <div ref={streamRef} style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {events.length === 0 ? (
                <EmptyState icon="bot" title={t('agent.empty.title')} body={t('agent.empty.body')} />
              ) : (
                events.map((ev, i) => <AgentEventCard key={i} ev={ev} t={t} lang={lang} />)
              )}
              {running && !['thinking','done'].includes(events[events.length - 1]?.kind) && (
                <ThinkingCard t={t} />
              )}
            </div>

            <div className="chat-composer">
              <div className="chat-composer-inner">
                <textarea
                  className="chat-composer-input"
                  placeholder={t('agent.composer')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) ask(input.trim()); } }}
                  rows={1}
                />
                <button className="send-btn" onClick={() => input.trim() && ask(input.trim())} disabled={!input.trim() || running} aria-label={t('common.send')}>
                  <Icon name={running ? 'square' : 'arrow-up'} size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT — schema */}
          <aside className="col" style={{ gap: 12, minHeight: 0 }}>
            <Eyebrow>{t('agent.schema')}</Eyebrow>
            <Card style={{ padding: 14 }}>
              <div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                <Icon name="shield" size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--nai-mint-600)' }} />
                <span>{t('agent.schema.note')}</span>
              </div>
              <div className="col" style={{ gap: 8 }}>
                {window.SCHEMA.map((tab) => <SchemaTable key={tab.name} {...tab} />)}
              </div>
            </Card>
          </aside>
        </div>
      ) : (
        <HistoryTab t={t} lang={lang} />
      )}
    </div>
  );
}

// ---- Event cards ----------------------------------------------------------

function AgentEventCard({ ev, t, lang }) {
  if (ev.kind === 'question') {
    return (
      <div className="materialize" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="bubble user" style={{ maxWidth: '70%' }}>{ev.text}</div>
      </div>
    );
  }
  if (ev.kind === 'thinking') return <ThinkingCard label={ev.label} t={t} />;
  if (ev.kind === 'sql') {
    return (
      <div className="agent-event materialize">
        <div className="agent-event-head">
          <span className="agent-event-icon" style={{ background: 'var(--nai-navy-50)', color: 'var(--nai-navy-700)' }}>
            <Icon name="database" size={13} strokeWidth={1.75} />
          </span>
          <span className="agent-event-kicker">{t('agent.kicker.sql')}</span>
        </div>
        <SqlBlock sql={ev.sql} />
      </div>
    );
  }
  if (ev.kind === 'result') {
    return (
      <div className="agent-event materialize">
        <div className="agent-event-head">
          <span className="agent-event-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Icon name="table-2" size={13} strokeWidth={1.75} />
          </span>
          <span className="agent-event-kicker">{t('agent.kicker.result')}</span>
          <span className="spacer"></span>
          <Badge tone="neutral" mono>{ev.rowCount} {ev.rowCount === 1 ? t('agent.rows.one') : t('agent.rows.many')}</Badge>
          <Badge tone="success" mono>{ev.durationMs} ms</Badge>
        </div>
        <ResultTable rows={ev.preview} />
      </div>
    );
  }
  if (ev.kind === 'error') {
    return (
      <div className="agent-event materialize" style={{ borderColor: 'var(--color-danger)' }}>
        <div className="agent-event-head">
          <span className="agent-event-icon" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <Icon name="circle-x" size={13} strokeWidth={2} />
          </span>
          <span className="agent-event-kicker" style={{ color: 'var(--color-danger)' }}>{t('agent.kicker.error')}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-fg)' }}>{ev.error}</p>
      </div>
    );
  }
  if (ev.kind === 'answer') return <StreamingAnswer text={ev.text} t={t} />;
  if (ev.kind === 'done') {
    return (
      <div className="materialize row" style={{ gap: 8, fontSize: 13, color: 'var(--color-fg-muted)', padding: '4px 2px' }}>
        <Icon name="circle-check" size={15} style={{ color: 'var(--color-success)' }} />
        <span>{t('agent.done', { n: ev.turns, turns: ev.turns === 1 ? t('agent.turns.one') : t('agent.turns.many') })}</span>
      </div>
    );
  }
  return null;
}

function ThinkingCard({ label, t }) {
  return (
    <div className="agent-event materialize">
      <div className="agent-event-head">
        <span className="agent-event-icon" style={{ background: 'var(--color-warn-bg)', color: 'var(--nai-amber-700)' }}>
          <Icon name="brain" size={13} strokeWidth={1.75} />
        </span>
        <span className="agent-event-kicker">{t('agent.kicker.thinking')}</span>
      </div>
      <div className="row" style={{ gap: 10, fontSize: 13 }}>
        <ThinkingDots />
        <span style={{ color: 'var(--color-fg-muted)' }}>{label || t('agent.thinking.default')}</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 10, width: '78%' }}></div>
        <div className="skeleton" style={{ height: 10, width: '62%' }}></div>
      </div>
    </div>
  );
}

function StreamingAnswer({ text, t }) {
  const { text: shown, done } = useStreamingText(text, { key: text });
  return (
    <div className="agent-event materialize">
      <div className="agent-event-head">
        <span className="agent-event-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--nai-mint-700)' }}>
          <Icon name="message-square" size={13} strokeWidth={1.75} />
        </span>
        <span className="agent-event-kicker">{t('agent.kicker.answer')}</span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-fg)' }} dangerouslySetInnerHTML={{ __html: shown.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}></p>
      {!done && <span className="stream-cursor"></span>}
    </div>
  );
}

function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>(empty)</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div style={{ overflow: 'auto', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
      <table className="result-table">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c}>{r[c]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Agent simulator (lang-aware) -----------------------------------------

function runAgentSimulation(q, lang, t, onEvent, onDone) {
  const plan = planFor(q, lang, t);
  let i = 0;
  function next() {
    if (i >= plan.length) { onDone(); return; }
    const step = plan[i++];
    setTimeout(() => { onEvent(step); next(); }, step.delay || 500);
  }
  next();
}

const AGENT_ANSWERS = {
  es: {
    total: 'La universidad tiene actualmente **8.472 estudiantes** registrados en la base académica. Este conteo incluye estudiantes activos en todos los programas, sin filtrar por carrera ni período. Si querés desglosarlo por carrera o por estado de matrícula, decímelo y armo otra consulta.',
    reprobaron: 'En el semestre **2025-1**, **47 estudiantes reprobaron Cálculo II** de un total de 218 inscritos — es decir, una tasa de reprobación del **21.6%**. Es alta comparada con el promedio general de la universidad (alrededor del 12%). Podría valer la pena revisar el contenido del curso o el perfil de ingreso a la carrera.',
    inscripciones: 'La materia con más inscripciones este semestre es **Cálculo I (MAT-101)** con **487 estudiantes**. Le siguen Introducción a la Ingeniería (312) y Comunicación oral y escrita (298). Cálculo I se dicta a casi toda la cohorte de ingreso, por eso lidera con un margen amplio.',
    default: 'Acá hay una muestra de 10 estudiantes registrados. La base contiene miles de filas — si querés, refiná la pregunta con un criterio (carrera, semestre de ingreso, etc.) y armo una consulta más útil.',
  },
  en: {
    total: 'The university currently has **8,472 students** registered in the academic database. This count includes active students across all programs, without filtering by major or term. If you want me to break it down by major or by enrollment status, tell me and I will run another query.',
    reprobaron: 'In term **2025-1**, **47 students failed Calculus II** out of 218 enrolled — a failure rate of **21.6%**. It is high compared to the university average (around 12%). It might be worth reviewing the course content or the program admission profile.',
    inscripciones: 'The course with the most enrollments this term is **Calculus I (MAT-101)** with **487 students**. It is followed by Introduction to Engineering (312) and Written and Oral Communication (298). Calculus I is taken by nearly the entire incoming cohort, which is why it leads by such a wide margin.',
    default: 'Here is a sample of 10 registered students. The database contains thousands of rows — if you want, narrow the question with a criterion (major, enrollment term, etc.) and I will run a more useful query.',
  },
};

const AGENT_THINKING = {
  es: {
    pickCount: 'Buscando una tabla con conteo de estudiantes…',
    mapFailed: 'Mapeando "reprobaron" → status=failed y "Cálculo II"…',
    context:   'Comparando con el total de inscripciones para dar contexto…',
    findTop:   'Buscando la materia más popular del semestre actual…',
  },
  en: {
    pickCount: 'Looking for a table with student counts…',
    mapFailed: 'Mapping "failed" → status=failed and "Calculus II"…',
    context:   'Comparing against total enrollments to add context…',
    findTop:   'Finding the most popular course this term…',
  },
};

function planFor(q, lang, t) {
  const norm = q.toLowerCase();
  const A = AGENT_ANSWERS[lang] || AGENT_ANSWERS.es;
  const TH = AGENT_THINKING[lang] || AGENT_THINKING.es;

  // --- total students
  if (norm.includes('total') || norm.includes('cuántos estudiantes hay') || norm.includes('how many students')) {
    return [
      { kind: 'thinking', label: TH.pickCount, delay: 400 },
      { kind: 'sql', sql: 'SELECT COUNT(*) AS total FROM students', delay: 900 },
      { kind: 'result', rowCount: 1, durationMs: 12, preview: [{ total: 8472 }], delay: 700 },
      { kind: 'answer', text: A.total, delay: 600 },
      { kind: 'done', turns: 1, delay: 1800 },
    ];
  }
  // --- failed Calculus
  if (norm.includes('reprobaron') || norm.includes('cálculo') || norm.includes('calculo') || norm.includes('failed') || norm.includes('calculus')) {
    return [
      { kind: 'thinking', label: TH.mapFailed, delay: 500 },
      { kind: 'sql', sql: "SELECT COUNT(*) AS reprobados\nFROM enrollments e\nJOIN courses c ON c.id = e.course_id\nWHERE c.name = 'Cálculo II'\n  AND e.term = '2025-1'\n  AND e.status = 'failed'", delay: 1000 },
      { kind: 'result', rowCount: 1, durationMs: 28, preview: [{ reprobados: 47 }], delay: 800 },
      { kind: 'thinking', label: TH.context, delay: 600 },
      { kind: 'sql', sql: "SELECT COUNT(*) AS total\nFROM enrollments e\nJOIN courses c ON c.id = e.course_id\nWHERE c.name = 'Cálculo II' AND e.term = '2025-1'", delay: 900 },
      { kind: 'result', rowCount: 1, durationMs: 19, preview: [{ total: 218 }], delay: 700 },
      { kind: 'answer', text: A.reprobaron, delay: 700 },
      { kind: 'done', turns: 2, delay: 2200 },
    ];
  }
  // --- top course
  if (norm.includes('inscripciones') || norm.includes('materia con más') || norm.includes('enrollments') || norm.includes('most')) {
    return [
      { kind: 'thinking', label: TH.findTop, delay: 400 },
      { kind: 'sql', sql: "SELECT c.code, c.name, COUNT(*) AS inscritos\nFROM enrollments e\nJOIN courses c ON c.id = e.course_id\nWHERE e.term = '2025-2'\nGROUP BY c.code, c.name\nORDER BY inscritos DESC\nLIMIT 5", delay: 950 },
      { kind: 'result', rowCount: 5, durationMs: 41, preview: [
        { code: 'MAT-101', name: lang === 'en' ? 'Calculus I' : 'Cálculo I', inscritos: 487 },
        { code: 'ING-110', name: lang === 'en' ? 'Intro to Engineering' : 'Introducción a la Ingeniería', inscritos: 312 },
        { code: 'LET-100', name: lang === 'en' ? 'Written & Oral Communication' : 'Comunicación oral y escrita', inscritos: 298 },
        { code: 'FIS-101', name: lang === 'en' ? 'Physics I' : 'Física I', inscritos: 274 },
        { code: 'INF-102', name: lang === 'en' ? 'Programming I' : 'Programación I', inscritos: 268 },
      ], delay: 800 },
      { kind: 'answer', text: A.inscripciones, delay: 600 },
      { kind: 'done', turns: 1, delay: 1800 },
    ];
  }
  // --- default
  return [
    { kind: 'thinking', delay: 400 },
    { kind: 'sql', sql: 'SELECT * FROM students LIMIT 10', delay: 800 },
    { kind: 'result', rowCount: 10, durationMs: 18, preview: [
      { id: 'a3f…', fullName: 'María González', email: 'm.gonzalez@uide.edu.ec' },
      { id: '7c2…', fullName: 'Carlos Vera',    email: 'c.vera@uide.edu.ec' },
      { id: 'e1b…', fullName: 'Ana Salazar',    email: 'a.salazar@uide.edu.ec' },
    ], delay: 700 },
    { kind: 'answer', text: A.default, delay: 600 },
    { kind: 'done', turns: 1, delay: 1800 },
  ];
}

// ---- History tab ----------------------------------------------------------

function HistoryTab({ t, lang }) {
  const rows = useMemo(() => buildAgentHistory(lang), [lang]);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 70px 80px 100px', gap: 12, padding: '10px 14px', background: 'var(--color-bg-sunken)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="eyebrow">{t('agent.history.h.question')}</div>
        <div className="eyebrow">{t('agent.history.h.sql')}</div>
        <div className="eyebrow">{t('agent.history.h.rows')}</div>
        <div className="eyebrow">{t('agent.history.h.time')}</div>
        <div className="eyebrow">{t('agent.history.h.when')}</div>
      </div>
      {rows.map((h) => (
        <div key={h.id} className="history-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={h.success ? 'circle-check' : 'circle-x'} size={14} style={{ color: h.success ? 'var(--color-success)' : 'var(--color-danger)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.question}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sql}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h.success ? h.rowCount : '—'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h.durationMs} ms</span>
          <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>{formatRelative(h.createdAt, lang)}</span>
        </div>
      ))}
    </Card>
  );
}

window.DemoAgent = DemoAgent;
