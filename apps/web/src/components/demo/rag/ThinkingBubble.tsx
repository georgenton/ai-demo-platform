// ThinkingBubble — placeholder de la burbuja del assistant mientras el
// backend está embebiendo la pregunta + buscando chunks (antes de que el
// LLM empiece a emitir tokens).
//
// Visualmente: misma estructura que Bubble assistant, pero el contenido
// son los ThinkingDots + un label corto ("Buscando fragmentos relevantes…").

import { ThinkingDots } from '@/components/ui';

export interface ThinkingBubbleProps {
  label: string;
}

export function ThinkingBubble({ label }: ThinkingBubbleProps) {
  return (
    <div className="bubble-row assistant materialize">
      <div className="avatar" aria-hidden>
        AI
      </div>
      <div
        className="bubble assistant"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
      >
        <ThinkingDots />
        <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
