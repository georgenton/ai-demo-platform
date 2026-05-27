// =============================================================================
// ui_kits/web/DemoComparator.jsx — Demo 02: Document comparator. Lang-aware.
// =============================================================================

function DemoComparator() {
  const { t, lang } = useT();
  const docs = useMemo(() => buildSampleDocsCompare(t), [lang]);
  const [selectedIds, setSelectedIds] = useState(['c1', 'c2']);
  const [dimensions, setDimensions] = useState(() => (window.SUGGESTED_DIMENSIONS_I18N[lang] || []).slice(0, 2));
  const [dimInput, setDimInput] = useState('');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [done, setDone] = useState(false);

  // When language changes, regenerate the (default) dimensions and clear output
  useEffect(() => {
    setDimensions((window.SUGGESTED_DIMENSIONS_I18N[lang] || []).slice(0, 2));
    setOutput('');
    setDone(false);
  }, [lang]);

  const suggestions = window.SUGGESTED_DIMENSIONS_I18N[lang] || [];

  function toggleDoc(id) {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 5) return ids;
      return [...ids, id];
    });
  }

  function addDimension(dim) {
    const d = dim.trim();
    if (!d || dimensions.includes(d) || dimensions.length >= 10) return;
    setDimensions((arr) => [...arr, d]);
    setDimInput('');
  }

  function removeDimension(d) { setDimensions((arr) => arr.filter((x) => x !== d)); }

  const valid = selectedIds.length >= 2 && dimensions.length >= 1;
  const selectedDocs = docs.filter((d) => selectedIds.includes(d.id));

  function start() {
    if (!valid || running) return;
    setRunning(true);
    setOutput('');
    setDone(false);
    const target = buildAnalysis(selectedDocs, dimensions, t, lang);
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setOutput(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(id);
        setRunning(false);
        setDone(true);
      }
    }, 16);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('cmp.eyebrow')}</div>
          <h1 className="page-title">{t('cmp.title')}</h1>
          <p className="page-subtitle">{t('cmp.subtitle')}</p>
        </div>
        <Button variant="accent" icon="sparkles" size="lg" disabled={!valid || running} onClick={start}>
          {running ? t('cmp.generating') : t('cmp.generate')}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 24 }}>
        <div className="col" style={{ gap: 22 }}>
          {/* Step 1 */}
          <section>
            <StepHeader n="1" label={t('cmp.step1.label')} hint={t('cmp.step1.hint', { n: selectedIds.length })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {docs.map((doc) => (
                <CompareDocRow
                  key={doc.id}
                  doc={doc}
                  selected={selectedIds.includes(doc.id)}
                  onToggle={() => toggleDoc(doc.id)}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <Button variant="ghost" icon="upload" size="sm">{t('cmp.step1.more')}</Button>
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <StepHeader n="2" label={t('cmp.step2.label')} hint={t('cmp.step2.hint', { n: dimensions.length })} />
            <Card className="card-flat" style={{ padding: 12 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6, padding: '2px 0 10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                {dimensions.length === 0 && (
                  <span style={{ fontSize: 13, color: 'var(--color-fg-subtle)' }}>{t('cmp.step2.empty')}</span>
                )}
                {dimensions.map((d) => (
                  <span key={d} className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: 12 }}>
                    {d}
                    <button onClick={() => removeDimension(d)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 4, opacity: 0.7 }} aria-label={t('common.remove')}>
                      <Icon name="x" size={11} strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  className="input"
                  value={dimInput}
                  onChange={(e) => setDimInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDimension(dimInput); } }}
                  placeholder={t('cmp.step2.input')}
                />
                <Button variant="secondary" icon="plus" onClick={() => addDimension(dimInput)} disabled={!dimInput.trim()}>{t('cmp.step2.add')}</Button>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{t('cmp.step2.suggestions')}</div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.filter((d) => !dimensions.includes(d)).map((d) => (
                    <Pill key={d} icon="plus" onClick={() => addDimension(d)}>{d}</Pill>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        </div>

        {/* Step 3 — output */}
        <div className="col" style={{ gap: 14, minHeight: 480 }}>
          <StepHeader n="3" label={t('cmp.step3.label')} hint={running ? t('cmp.step3.streaming') : done ? t('cmp.step3.done') : t('cmp.step3.pending')} />
          <Card style={{ padding: 0, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="git-compare-arrows" size={14} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{t('cmp.step3.docsXdim', { docs: selectedDocs.length, dims: dimensions.length })}</span>
              </div>
              {done && <Badge tone="success" icon="check">{t('common.done')}</Badge>}
              {running && <Badge tone="info" icon="loader">{t('common.streaming')}</Badge>}
            </div>
            <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
              {!output && !running && (
                <EmptyState
                  icon="file-search"
                  title={t('cmp.step3.ready.title')}
                  body={t('cmp.step3.ready.body')}
                />
              )}
              {(output || running) && (
                <div style={{ fontSize: 14, color: 'var(--color-fg)', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: renderMarkdownish(output) + (running ? '<span class="stream-cursor"></span>' : '') }}></div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ n, label, hint }) {
  return (
    <div className="row" style={{ marginBottom: 12, gap: 10 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--nai-navy-800)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{n}</span>
      <h3 style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</h3>
      <span className="spacer"></span>
      {hint && <span className="eyebrow">{hint}</span>}
    </div>
  );
}

function CompareDocRow({ doc, selected, onToggle, t, lang }) {
  return (
    <button type="button" className={'doc-card ' + (selected ? 'selected' : '')} onClick={onToggle} style={{ textAlign: 'left', font: 'inherit', color: 'inherit' }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid ' + (selected ? 'var(--nai-mint-500)' : 'var(--color-border-strong)'), background: selected ? 'var(--nai-mint-500)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        {selected && <Icon name="check" size={12} strokeWidth={3} style={{ color: 'var(--nai-navy-900)' }} />}
      </span>
      <div className="doc-icon" style={{ width: 32, height: 38 }}>PDF</div>
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
    </button>
  );
}

function renderMarkdownish(text) {
  let s = text
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin-top:18px;margin-bottom:6px;color:var(--color-fg)">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin-top:22px;margin-bottom:8px;color:var(--color-fg);letter-spacing:-0.01em">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600;color:var(--color-fg)">$1</strong>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="citation-inline">$1</span>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:10px;margin:4px 0"><span style="color:var(--color-accent)">·</span><span>$1</span></div>')
    .replace(/\n/g, '<br>');
  return s;
}

// -- Lang-aware analysis builder --------------------------------------------

const ANALYSIS_HEADINGS = {
  es: { sum: 'Resumen ejecutivo', concl: 'Conclusión', intro: 'Comparé **{n} documentos** sobre **{d} dimensiones**. A continuación, los hallazgos relevantes, con frases textuales y referencias a cada documento.', concText: 'El contrato más favorable en plazos es **{a}**, aunque presenta penalizaciones más severas. Si la prioridad es flexibilidad operativa, **{b}** ofrece mejores condiciones de pago. Recomiendo revisar manualmente las cláusulas de garantía antes de decidir.' },
  en: { sum: 'Executive summary', concl: 'Conclusion', intro: 'I compared **{n} documents** across **{d} dimensions**. Below are the relevant findings, with verbatim phrases and references per document.', concText: 'The most favorable on deadlines is **{a}**, though it carries harsher penalties. If operational flexibility is the priority, **{b}** offers better payment terms. I recommend reviewing the warranty clauses manually before deciding.' },
};

function buildAnalysis(docs, dimensions, t, lang) {
  const docNames = docs.map((d) => d.name.replace(/\.pdf$/i, ''));
  const h = ANALYSIS_HEADINGS[lang] || ANALYSIS_HEADINGS.es;
  let out = `## ${h.sum}\n\n`;
  out += h.intro.replace('{n}', docs.length).replace('{d}', dimensions.length) + '\n\n';
  dimensions.forEach((dim) => {
    out += `### ${dim}\n\n`;
    docNames.forEach((name, i) => {
      const phrase = phraseFor(dim, i, lang);
      out += `- **${name}** — ${phrase} [[${name}, ${t('cmp.step3.cita')} ${i + 3}.${(i + 1) * 2}]]\n`;
    });
    out += `\n`;
  });
  out += `## ${h.concl}\n\n`;
  out += h.concText.replace('{a}', docNames[0]).replace('{b}', docNames[1] || docNames[0]);
  return out;
}

const PHRASES = {
  es: {
    plazo: ['90 días corridos desde firma', '120 días con 2 prórrogas posibles', '60 días sin opción de prórroga'],
    penaliz: ['1.5% diario, máximo 15%', '0.8% diario, máximo 10%', '2.0% diario, sin tope explícito'],
    respons: ['Responsabilidad civil hasta USD 500.000', 'Responsabilidad solidaria con subcontratistas', 'Responsabilidad limitada al monto del contrato'],
    pago: ['30% anticipo, 70% contra entrega', '50/50 con factura mensual', 'Pagos parciales trimestrales'],
    garant: ['Garantía de 24 meses sobre obra', 'Garantía de 12 meses sobre obra y equipos', 'Sin garantía explícita en el documento'],
    default: ['Cláusula estándar conforme a la normativa local', 'Condiciones específicas con varias excepciones', 'Tratamiento genérico, sin definiciones cuantitativas'],
  },
  en: {
    plazo: ['90 calendar days from signing', '120 days with 2 possible extensions', '60 days with no extension option'],
    penaliz: ['1.5% per day, capped at 15%', '0.8% per day, capped at 10%', '2.0% per day, no explicit cap'],
    respons: ['Civil liability up to USD 500,000', 'Joint liability with subcontractors', 'Liability limited to contract value'],
    pago: ['30% upfront, 70% upon delivery', '50/50 with monthly invoicing', 'Quarterly partial payments'],
    garant: ['24-month warranty on the work', '12-month warranty on work and equipment', 'No explicit warranty in the document'],
    default: ['Standard clause per local regulation', 'Specific conditions with several exceptions', 'Generic treatment, no quantitative definitions'],
  },
};

function phraseFor(dim, i, lang) {
  const dimL = dim.toLowerCase();
  const set = PHRASES[lang] || PHRASES.es;
  if (dimL.includes('plazo') || dimL.includes('deadline')) return set.plazo[i % 3];
  if (dimL.includes('penaliz') || dimL.includes('penalt')) return set.penaliz[i % 3];
  if (dimL.includes('respons')) return set.respons[i % 3];
  if (dimL.includes('pago') || dimL.includes('costo') || dimL.includes('payment')) return set.pago[i % 3];
  if (dimL.includes('garant') || dimL.includes('warrant')) return set.garant[i % 3];
  return set.default[i % 3];
}

window.DemoComparator = DemoComparator;
