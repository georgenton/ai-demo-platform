// MarkdownOutput — pinta el resultado del parser renderMarkdown como
// elementos React. XSS-safe (no dangerouslySetInnerHTML).
//
// Se usa para mostrar el output del comparador a medida que streamea, y
// cuando termina. El cursor parpadeante (`<span class="stream-cursor"/>`)
// se renderiza por separado en la página padre, después de este componente,
// cuando status === 'streaming'.

import {
  renderMarkdown,
  type InlineToken,
  type LineToken,
} from './render-markdown';

export interface MarkdownOutputProps {
  text: string;
}

export function MarkdownOutput({ text }: MarkdownOutputProps) {
  const lines = renderMarkdown(text);
  return (
    <div
      style={{
        fontSize: 14,
        color: 'var(--color-fg)',
        lineHeight: 1.65,
      }}
    >
      {lines.map((line, i) => (
        <LineBlock key={i} line={line} />
      ))}
    </div>
  );
}

function LineBlock({ line }: { line: LineToken }) {
  switch (line.kind) {
    case 'blank':
      return <div style={{ height: 8 }} aria-hidden />;
    case 'h2':
      return (
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginTop: 22,
            marginBottom: 8,
            color: 'var(--color-fg)',
            letterSpacing: '-0.01em',
          }}
        >
          <Inlines tokens={line.inline} />
        </h3>
      );
    case 'h3':
      return (
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginTop: 18,
            marginBottom: 6,
            color: 'var(--color-fg)',
          }}
        >
          <Inlines tokens={line.inline} />
        </h4>
      );
    case 'list-item':
      return (
        <div style={{ display: 'flex', gap: 10, margin: '4px 0' }}>
          <span style={{ color: 'var(--color-accent)' }} aria-hidden>
            ·
          </span>
          <span>
            <Inlines tokens={line.inline} />
          </span>
        </div>
      );
    case 'paragraph':
      return (
        <p style={{ margin: '6px 0' }}>
          <Inlines tokens={line.inline} />
        </p>
      );
    default: {
      const _exhaustive: never = line;
      void _exhaustive;
      return null;
    }
  }
}

function Inlines({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, i) => {
        if (token.kind === 'bold') {
          return (
            <strong
              key={i}
              style={{ fontWeight: 600, color: 'var(--color-fg)' }}
            >
              {token.text}
            </strong>
          );
        }
        if (token.kind === 'citation') {
          return (
            <span key={i} className="citation-inline">
              {token.text}
            </span>
          );
        }
        return <span key={i}>{token.text}</span>;
      })}
    </>
  );
}
