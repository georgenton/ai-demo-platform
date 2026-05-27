// CorpusViz — visual decorativo arriba a la derecha del hero del teaser.
// Grid 14×5 de cuadraditos pulsantes; uno de cada 4 es mint, el resto
// blanco translúcido. Animación `corpus-blink` con delay por cell.
//
// Port literal del kit. Usamos `useMemo` para generar el array una sola
// vez (los delays/opacities son aleatorios; sin memo, cada re-render
// regeneraría los valores y el grid haría flicker).

'use client';

import { useMemo } from 'react';

interface Cell {
  delay: number;
  opacity: number;
  isMint: boolean;
}

const COLS = 14;
const ROWS = 5;

export function CorpusViz() {
  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({
          delay: (r * 0.15 + c * 0.05) % 2.4,
          opacity: 0.15 + Math.random() * 0.6,
          isMint: c % 4 === 0,
        });
      }
    }
    return out;
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        right: 28,
        top: 28,
        width: 220,
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: 4,
        opacity: 0.8,
      }}
      aria-hidden
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: cell.isMint ? '#43c194' : '#ffffff',
            opacity: cell.opacity,
            animation: `corpus-blink 2.4s ease-in-out ${cell.delay}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes corpus-blink { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.9; } }`}</style>
    </div>
  );
}
