// =============================================================================
// ui_kits/web/Shell.jsx — App shell: sidebar + header. Lang-aware.
// =============================================================================

function Shell({ activeDemoId, onSelectDemo, theme, onToggleTheme, lang, onToggleLang, children }) {
  const { t } = useT();
  const demos = useMemo(() => buildDemos(t), [t]);
  return (
    <div className="app-shell">
      <Sidebar demos={demos} activeDemoId={activeDemoId} onSelectDemo={onSelectDemo} t={t} />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Header demos={demos} activeDemoId={activeDemoId} theme={theme} onToggleTheme={onToggleTheme} lang={lang} onToggleLang={onToggleLang} t={t} />
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ demos, activeDemoId, onSelectDemo, t }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="../../assets/logo-mark.svg" width="32" height="32" alt="" style={{ display: 'block' }} />
        <div>
          <div className="sidebar-brand-name">AI Demo Platform</div>
          <div className="sidebar-brand-tag">{t('shell.brand.tag')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="sidebar-section-label">{t('shell.demos')}</div>
        {demos.map((demo) => (
          <DemoItem
            key={demo.id}
            demo={demo}
            active={demo.id === activeDemoId}
            comingLabel={t('shell.coming')}
            onClick={() => onSelectDemo(demo.id)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }}></div>

      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--color-fg-muted)' }}>
        <div className="health-dot"></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--color-fg)', fontWeight: 500 }}>{t('shell.servicio')}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{t('shell.servicio.meta')}</span>
        </div>
      </div>
    </aside>
  );
}

function DemoItem({ demo, active, onClick, comingLabel }) {
  // All four demos are clickable (even "coming soon" — Corpus has a teaser page).
  return (
    <button
      type="button"
      className={['demo-item', active && 'active'].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <Icon name={demo.icon} size={18} className="demo-item-icon" />
      <div className="demo-item-body">
        <div className="demo-item-title">
          {demo.title}
          {demo.status === 'coming-soon' && (
            <span className="badge badge-info" style={{ fontSize: 9.5, padding: '1px 6px' }}>{comingLabel}</span>
          )}
        </div>
        <div className="demo-item-sub">{demo.tagline}</div>
      </div>
    </button>
  );
}

function Header({ demos, activeDemoId, theme, onToggleTheme, lang, onToggleLang, t }) {
  const idx = demos.findIndex((d) => d.id === activeDemoId);
  const active = idx >= 0 ? demos[idx] : demos[0];
  const num = String((idx >= 0 ? idx : 0) + 1).padStart(2, '0');
  return (
    <header className="header">
      <div className="header-title">
        <span className="header-eyebrow">{t('header.demo')} · {num}</span>
        <span className="header-name">{active?.title}</span>
      </div>

      <div className="spacer"></div>

      <div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--color-fg-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        <Icon name="globe" size={14} />
        <span>Anthropic API</span>
        <span style={{ opacity: 0.5 }}>→</span>
        <span>NAI on-prem</span>
        <Badge tone="info">{t('shell.dev')}</Badge>
      </div>

      <LangSwitch lang={lang} onToggle={onToggleLang} title={t('shell.lang.tip')} />

      <button className="theme-toggle" onClick={onToggleTheme} title={t('shell.theme.tip')} aria-label={t('shell.theme.tip')}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
    </header>
  );
}

// Two-letter segmented control: ES / EN
function LangSwitch({ lang, onToggle, title }) {
  return (
    <div
      role="group"
      title={title}
      style={{
        display: 'inline-flex',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-elevated)',
        height: 32,
        padding: 2,
        boxShadow: 'var(--shadow-inset)',
      }}
    >
      <LangChip code="es" active={lang === 'es'} onClick={() => lang !== 'es' && onToggle()} />
      <LangChip code="en" active={lang === 'en'} onClick={() => lang !== 'en' && onToggle()} />
    </div>
  );
}
function LangChip({ code, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? '1' : '0'}
      style={{
        font: 'inherit',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '0 9px',
        height: 26,
        minWidth: 30,
        background: active ? 'var(--lang-active-bg)' : 'transparent',
        color: active ? 'var(--lang-active-fg)' : 'var(--color-fg-muted)',
        border: 0,
        borderRadius: 4,
        cursor: active ? 'default' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
      }}
    >
      {code}
    </button>
  );
}

window.Shell = Shell;
window.Header = Header;
