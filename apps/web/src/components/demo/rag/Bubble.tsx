// Bubble — burbuja del chat. Soporta dos roles:
//   - 'user'      → burbuja a la derecha, fondo navy-50.
//   - 'assistant' → burbuja a la izquierda con avatar "AI". Puede tener
//                   cursor parpadeante mientras se stremea (prop `streaming`).
//
// Citas: el texto pasa por renderCitations() → tokens text/citation/break.
// La burbuja pinta cada token con su clase del kit (.citation-inline para
// las citas, <br/> para los breaks).

import { renderCitations } from './render-citations';

export interface BubbleProps {
  role: 'user' | 'assistant';
  text: string;
  /** Si true, render del cursor parpadeante al final (`.stream-cursor`). */
  streaming?: boolean;
}

export function Bubble({ role, text, streaming = false }: BubbleProps) {
  if (role === 'user') {
    return (
      <div className="bubble-row user">
        <div className="bubble user">{text}</div>
      </div>
    );
  }

  const tokens = renderCitations(text);

  return (
    <div className="bubble-row assistant">
      <div className="avatar" aria-hidden>
        AI
      </div>
      <div className="bubble assistant">
        {tokens.map((token, i) => {
          if (token.kind === 'break') return <br key={i} />;
          if (token.kind === 'citation') {
            return (
              <span key={i} className="citation-inline">
                {token.text}
              </span>
            );
          }
          return <span key={i}>{token.text}</span>;
        })}
        {streaming && <span className="stream-cursor" aria-hidden />}
      </div>
    </div>
  );
}
