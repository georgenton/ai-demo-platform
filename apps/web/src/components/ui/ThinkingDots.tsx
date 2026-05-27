// ThinkingDots — port TS de ui.jsx::ThinkingDots.
//
// Tres dots que pulsan en secuencia (animación "td-pulse"). Lo usamos para
// la card "Pensando" del agente y el ThinkingBubble del chat.
//
// El keyframe `td-pulse` vive inline en el componente porque solo se usa
// acá; ponerlo en ui-kit.css contaminaría el global por una animación de
// 3 líneas que no necesita customización.

import type { CSSProperties } from 'react';

function dotStyle(delay: number): CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-fg-muted)',
    animation: `td-pulse 1.2s ease-in-out ${delay}s infinite`,
  };
}

export function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <span style={dotStyle(0)} />
      <span style={dotStyle(0.2)} />
      <span style={dotStyle(0.4)} />
      <style>{`
        @keyframes td-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
          40%           { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </span>
  );
}
