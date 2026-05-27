// =============================================================================
// ui_kits/web/DemoCorpus.jsx — Demo 03: Corpus academic analyzer (teaser).
// Lang-aware.
// =============================================================================

function DemoCorpus() {
  const { t, lang } = useT();
  const dateLabels = lang === 'en'
    ? { mar: 'MAR 2026', may: 'MAY 2026', jun: 'JUN 2026', jul: 'JUL 2026', q3: 'Q3 2026' }
    : { mar: 'MAR 2026', may: 'MAY 2026', jun: 'JUN 2026', jul: 'JUL 2026', q3: 'Q3 2026' };

  return (
    <div className="page">
      <div className="teaser-hero">
        <CorpusViz />
        <div className="teaser-eyebrow">
          <Icon name="zap" size={11} strokeWidth={2.2} />
          {t('corpus.eyebrow')}
        </div>
        <h1 className="teaser-title">{t('corpus.title')}</h1>
        <p className="teaser-desc">{t('corpus.desc')}</p>
        <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
          <Button variant="accent" icon="bell" size="lg">{t('corpus.notify')}</Button>
          <Button variant="ghost" iconRight="arrow-right" size="lg" style={{ color: 'rgba(255,255,255,0.85)' }}>{t('corpus.roadmap')}</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 28 }}>
        <CapabilityCard icon="layers-3"        title={t('corpus.cap1.title')} body={t('corpus.cap1.body')} />
        <CapabilityCard icon="git-branch-plus" title={t('corpus.cap2.title')} body={t('corpus.cap2.body')} />
        <CapabilityCard icon="line-chart"      title={t('corpus.cap3.title')} body={t('corpus.cap3.body')} />
      </div>

      <div style={{ marginTop: 32 }}>
        <Eyebrow>{t('corpus.status')}</Eyebrow>
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 11, top: 14, bottom: 14, width: 1, background: 'var(--color-border)' }}></div>
          <div className="col" style={{ gap: 16 }}>
            <Milestone done    label={t('corpus.m1')} date={dateLabels.mar} />
            <Milestone done    label={t('corpus.m2')} date={dateLabels.may} />
            <Milestone current label={t('corpus.m3')} date={dateLabels.may} />
            <Milestone         label={t('corpus.m4')} date={dateLabels.jun} />
            <Milestone         label={t('corpus.m5')} date={dateLabels.jul} />
            <Milestone highlight label={t('corpus.m6')} date={dateLabels.q3} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ icon, title, body }) {
  return (
    <Card>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nai-mint-700)' }}>
        <Icon name={icon} size={18} strokeWidth={1.7} />
      </div>
      <h4 style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>{title}</h4>
      <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-fg-muted)', lineHeight: 1.55 }}>{body}</p>
    </Card>
  );
}

function Milestone({ label, date, done, current, highlight }) {
  const color = done ? 'var(--color-success)' : current ? 'var(--color-accent)' : 'var(--color-border-strong)';
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative', paddingLeft: 4 }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: done ? 'var(--color-success)' : current ? 'var(--color-accent)' : 'var(--color-bg)', border: '2px solid ' + color, flexShrink: 0, zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {done && <Icon name="check" size={9} strokeWidth={3.5} style={{ color: 'white' }} />}
      </span>
      <div style={{ flex: 1, fontSize: 14, color: highlight ? 'var(--color-fg)' : (done ? 'var(--color-fg-muted)' : 'var(--color-fg)'), fontWeight: highlight ? 600 : (current ? 600 : 400) }}>
        {label}
      </div>
      <span className="eyebrow">{date}</span>
    </div>
  );
}

function CorpusViz() {
  const cols = 14, rows = 5;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const delay = (r * 0.15 + c * 0.05) % 2.4;
      const opacity = 0.15 + Math.random() * 0.6;
      cells.push(
        <span key={`${r}-${c}`} style={{
          width: 8, height: 8, borderRadius: 2,
          background: c % 4 === 0 ? '#43c194' : '#ffffff',
          opacity,
          animation: `corpus-blink 2.4s ease-in-out ${delay}s infinite`,
        }}></span>
      );
    }
  }
  return (
    <div style={{ position: 'absolute', right: 28, top: 28, width: 220, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, opacity: 0.8 }}>
      {cells}
      <style>{`@keyframes corpus-blink { 0%,100% { opacity: 0.12; } 50% { opacity: 0.9; } }`}</style>
    </div>
  );
}

window.DemoCorpus = DemoCorpus;
