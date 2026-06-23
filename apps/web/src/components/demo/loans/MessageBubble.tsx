// -----------------------------------------------------------------------------
// MessageBubble — un bubble del chat tipo WhatsApp. Lado depende del role.
//
// Variantes:
//   - role='user'      → bubble a la derecha, verde claro.
//   - role='assistant' → bubble a la izquierda, blanco con sombra.
//   - role='system'    → mensaje gris centrado (eventos de tool).
//
// `content` puede llegar como string normal o como nodo React (para
// los eventos de tool que muestran un icono).
// -----------------------------------------------------------------------------

'use client';

import type { ReactNode } from 'react';

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: ReactNode;
  /** Hora del mensaje (HH:MM). Si se omite no se muestra. */
  time?: string;
  /** Indica que el bubble es el ÚLTIMO del assistant y está streaming. */
  streaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  time,
  streaming = false,
}: Props) {
  if (role === 'system') {
    return (
      <div className="loans-bubble-system">
        <span>{content}</span>
      </div>
    );
  }
  return (
    <div className={`loans-bubble loans-bubble-${role}`}>
      <div className="loans-bubble-content">
        {content}
        {streaming && (
          <span className="loans-bubble-caret" aria-hidden="true" />
        )}
      </div>
      {time && <div className="loans-bubble-time">{time}</div>}
    </div>
  );
}
