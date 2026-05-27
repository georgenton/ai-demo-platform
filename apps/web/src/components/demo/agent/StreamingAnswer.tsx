// StreamingAnswer — card del bloque "respuesta" del LLM. Renderiza el texto
// con un parsing markdown-light (negritas con **) + el cursor parpadeante
// mientras streaming.

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

export interface StreamingAnswerProps {
  text: string;
  streaming: boolean;
}

export function StreamingAnswer({ text, streaming }: StreamingAnswerProps) {
  const { t } = useT();
  return (
    <div className="agent-event materialize">
      <div className="agent-event-head">
        <span
          className="agent-event-icon"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--nai-mint-700)',
          }}
        >
          <Icon name="message-square" size={13} strokeWidth={1.75} />
        </span>
        <span className="agent-event-kicker">{t('agent.kicker.answer')}</span>
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--color-fg)',
          margin: 0,
        }}
      >
        {renderInlineBold(text)}
        {streaming && <span className="stream-cursor" aria-hidden />}
      </p>
    </div>
  );
}

/**
 * Parser mínimo de **bold**: tokeniza en chunks {plain, bold} y devuelve
 * un array de <span> / <strong>. NO usa dangerouslySetInnerHTML — XSS-safe.
 */
function renderInlineBold(text: string) {
  const parts: { kind: 'plain' | 'bold'; text: string }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ kind: 'plain', text: text.slice(cursor, match.index) });
    }
    parts.push({ kind: 'bold', text: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ kind: 'plain', text: text.slice(cursor) });
  }
  return parts.map((part, i) =>
    part.kind === 'bold' ? (
      <strong key={i} style={{ fontWeight: 600 }}>
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
