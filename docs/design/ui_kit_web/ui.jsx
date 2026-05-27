// =============================================================================
// ui_kits/web/ui.jsx — shared UI primitives.
// All exported to window so other Babel <script>s can use them.
// =============================================================================

const { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } = React;

// ---- Icon ------------------------------------------------------------------
// Tiny wrapper around Lucide. Renders an <i data-lucide>; calls createIcons
// after mount so DOM elements get their SVGs swapped in.
function Icon({ name, size = 16, className = '', style = {}, strokeWidth = 1.5 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (window.lucide && ref.current) {
      window.lucide.createIcons({ icons: window.lucide.icons, nameAttr: 'data-lucide', attrs: { 'stroke-width': strokeWidth }, target: ref.current.parentNode });
    }
  });
  return <i ref={ref} data-lucide={name} className={'ic ' + className} style={{ width: size, height: size, ...style }}></i>;
}

// ---- Button ----------------------------------------------------------------
function Button({ variant = 'primary', size = 'md', icon, iconRight, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 16} />}
    </button>
  );
}

// ---- Badge -----------------------------------------------------------------
function Badge({ tone = 'neutral', icon, mono = false, children }) {
  const cls = ['badge', `badge-${tone}`, mono && 'badge-mono'].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {icon && <Icon name={icon} size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}

// ---- Pill ------------------------------------------------------------------
function Pill({ selected, icon, onClick, children }) {
  return (
    <button type="button" className={'pill ' + (selected ? 'selected' : '')} onClick={onClick}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}

// ---- Card ------------------------------------------------------------------
function Card({ className = '', style, children, hover = false, flat = false }) {
  return (
    <div className={['card', hover && 'card-hover', flat && 'card-flat', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

// ---- Eyebrow ---------------------------------------------------------------
function Eyebrow({ children, dot, color }) {
  return (
    <div className="eyebrow" style={{ color: color || 'var(--color-fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>}
      {children}
    </div>
  );
}

// ---- EmptyState ------------------------------------------------------------
function EmptyState({ icon, title, body, action }) {
  return (
    <div className="empty-state">
      {icon && (
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-fg-muted)' }}>
          <Icon name={icon} size={26} strokeWidth={1.4} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

// ---- ProgressDots — for "thinking" --------------------------------------
function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <span style={dotStyle(0)}></span>
      <span style={dotStyle(0.2)}></span>
      <span style={dotStyle(0.4)}></span>
      <style>{`
        @keyframes td-pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }
      `}</style>
    </span>
  );
}
function dotStyle(delay) {
  return {
    width: 6, height: 6, borderRadius: '50%', background: 'var(--color-fg-muted)',
    animation: `td-pulse 1.2s ease-in-out ${delay}s infinite`,
  };
}

// ---- Modal (lightweight scrim + dialog) ------------------------------------
function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(8, 21, 42, 0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', boxShadow: 'var(--shadow-lg)', padding: 0, animation: 'materialize 220ms cubic-bezier(0.2,0.7,0.2,1)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 15, fontWeight: 600 }}>{title}</strong>
          <button onClick={onClose} className="theme-toggle" aria-label="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ---- Schema card (Demo 04) -------------------------------------------------
function SchemaTable({ name, columns }) {
  return (
    <div className="schema-table">
      <div className="schema-table-head">
        <Icon name="table" size={12} />
        <span className="schema-table-name">{name}</span>
      </div>
      <div>
        {columns.map((c) => (
          <div className="schema-col" key={c.name}>
            <span className="schema-col-name">{c.name}</span>
            <span className="schema-col-type">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- SQL block (poor-man's syntax highlight) -------------------------------
const SQL_KW = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INNER|LEFT|RIGHT|JOIN|ON|AS|AND|OR|NOT|IN|IS|NULL|DESC|ASC|DISTINCT)\b/g;
const SQL_FN = /\b(COUNT|AVG|SUM|MIN|MAX|EXTRACT|DATE_TRUNC|LOWER|UPPER|COALESCE)\b/g;
function highlightSQL(sql) {
  // Order matters: protect strings first, then keywords/fns/numbers.
  const tokens = [];
  let s = sql
    .replace(/'([^']*)'/g, (m) => { tokens.push({ kind: 'str', text: m }); return `\u0000${tokens.length - 1}\u0000`; });
  s = s
    .replace(SQL_KW, (m) => `\u0001${m}\u0001`)
    .replace(SQL_FN, (m) => `\u0002${m}\u0002`)
    .replace(/\b(\d+)\b/g, (m) => `\u0003${m}\u0003`);
  const parts = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\u0000' || ch === '\u0001' || ch === '\u0002' || ch === '\u0003') {
      if (buf) { parts.push({ kind: 'punc', text: buf }); buf = ''; }
      const end = s.indexOf(ch, i + 1);
      const inner = s.slice(i + 1, end);
      const kind = ch === '\u0000' ? 'str' : ch === '\u0001' ? 'kw' : ch === '\u0002' ? 'fn' : 'num';
      const text = kind === 'str' ? tokens[parseInt(inner)].text : inner;
      parts.push({ kind, text });
      i = end;
    } else { buf += ch; }
  }
  if (buf) parts.push({ kind: 'punc', text: buf });
  return parts;
}

function SqlBlock({ sql }) {
  const parts = highlightSQL(sql);
  return (
    <pre className="sql-block">
      <code>
        {parts.map((p, i) => <span key={i} className={p.kind}>{p.text}</span>)}
      </code>
    </pre>
  );
}

// ---- Streaming text simulation hook ---------------------------------------
// Streams a full string out char-by-char at ~30 chars/sec; calls onDone when finished.
function useStreamingText(fullText, opts = {}) {
  const { speed = 22, autoStart = true, key = 0 } = opts;
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!autoStart) return;
    setText('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += Math.max(1, Math.round(speed / 18)); // chunks of ~1-3 chars per tick
      const next = fullText.slice(0, i);
      setText(next);
      if (i >= fullText.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => clearInterval(id);
  }, [fullText, autoStart, key, speed]);
  return { text, done };
}

// ---- Format helpers --------------------------------------------------------
function formatRelativeES(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

// ---- Export to window ------------------------------------------------------
Object.assign(window, {
  Icon, Button, Badge, Pill, Card, Eyebrow, EmptyState, ThinkingDots,
  Modal, SchemaTable, SqlBlock, useStreamingText, formatRelativeES,
});
