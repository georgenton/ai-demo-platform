// TutorBubble — burbuja del chat del tutor (Demo 05).
//
// Mismo look que el Bubble del RAG (.bubble-row + .bubble del kit), pero
// sin renderizado de citas y con dos extras:
//   - Mostramos el body limpio (sin el "💡 Tip: ..." al final), porque ese
//     pedazo se reproduce aparte en el FeedbackPanel.
//   - Cursor parpadeante mientras streama.

import { extractTip } from './extract-tip';

export interface TutorBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  /** Si true, muestra el cursor parpadeante al final. */
  streaming?: boolean;
}

export function TutorBubble({
  role,
  text,
  streaming = false,
}: TutorBubbleProps) {
  if (role === 'user') {
    return (
      <div className="bubble-row user">
        <div className="bubble user">{text}</div>
      </div>
    );
  }

  // Para el assistant, sacamos el tip del cuerpo — vive en otro panel.
  const { body } = extractTip(text);

  return (
    <div className="bubble-row assistant">
      <div className="avatar" aria-hidden>
        AI
      </div>
      <div className="bubble assistant">
        {body}
        {streaming && <span className="stream-cursor" aria-hidden />}
      </div>
    </div>
  );
}
