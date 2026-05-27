// -----------------------------------------------------------------------------
// useKeybindings — atajos globales de teclado del shell.
//
// Atajos soportados:
//   · g r       → /demo/rag
//   · g c       → /demo/comparator
//   · g a       → /demo/agent
//   · g s       → /demo/corpus  (s de "study", para no chocar con c=comparator)
//   · g h       → /             (home / landing)
//   · ?         → toggle del overlay de ayuda
//   · Esc       → cierra overlay si está abierto
//   · Shift+P   → toggle modo presentación
//
// Patrón "leader" (g + letra) inspirado en GitHub / Gmail / Linear:
//   - Cuando el usuario aprieta `g`, abrimos un "leader mode" con timeout
//     de 1500ms. Si la próxima tecla matchea un destino, navegamos.
//     Si pasa el timeout o aprietan algo distinto, cancelamos.
//
// Cuándo los atajos NO se disparan:
//   - El foco está en <input>, <textarea>, [contenteditable] — sino
//     escribir "g" en el chat dispararía navegación.
//   - Hay modificadores cmd/ctrl/alt — para no chocar con shortcuts del SO
//     o del navegador (Cmd+G = buscar, etc.). Excepción: Shift, que SÍ
//     usamos (Shift+P) y Shift+/ = "?".
//
// Por qué un solo hook y no varios (uno por feature):
//   - Tiene que decidir si está en "leader mode" o no antes de procesar.
//     Esa decisión es global. Separarlo en hooks distintos haría que cada
//     uno se enterara del leader mode por separado — más complejo.
// -----------------------------------------------------------------------------

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Tiempo máximo entre `g` y la siguiente tecla para considerar la secuencia. */
const LEADER_TIMEOUT_MS = 1500;

/** Mapa estático leader-key → ruta. Si crece, mover a un módulo dedicado. */
const LEADER_ROUTES: Record<string, string> = {
  r: '/demo/rag',
  c: '/demo/comparator',
  a: '/demo/agent',
  s: '/demo/corpus',
  h: '/',
};

export interface UseKeybindingsOptions {
  /** Toggle del overlay de cheatsheet (?). */
  onToggleHelp: () => void;
  /** Cerrar overlay si está abierto (Esc). */
  onCloseHelp: () => void;
  /** Toggle modo presentación (Shift+P). */
  onTogglePresenting: () => void;
  /**
   * Cuando es true, solo Esc se procesa — los demás atajos quedan dormidos.
   * Pensado para cuando el overlay de help está abierto: queremos que
   * `g r` no navegue mientras el modal está visible.
   */
  helpOpen: boolean;
}

export function useKeybindings({
  onToggleHelp,
  onCloseHelp,
  onTogglePresenting,
  helpOpen,
}: UseKeybindingsOptions): void {
  const router = useRouter();

  // El ref guarda si estamos esperando la segunda tecla del leader.
  // Usar ref (no state) porque cambia muy seguido y no debe causar re-render.
  const leaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaderActiveRef = useRef(false);

  // Las callbacks + flags vienen del componente padre. Las guardamos en refs
  // para que el `useEffect` de abajo se corra una sola vez (sin re-suscribir
  // el listener cada vez que el padre re-renderice).
  const onToggleHelpRef = useRef(onToggleHelp);
  const onCloseHelpRef = useRef(onCloseHelp);
  const onTogglePresentingRef = useRef(onTogglePresenting);
  const helpOpenRef = useRef(helpOpen);
  onToggleHelpRef.current = onToggleHelp;
  onCloseHelpRef.current = onCloseHelp;
  onTogglePresentingRef.current = onTogglePresenting;
  helpOpenRef.current = helpOpen;

  useEffect(() => {
    function cancelLeader() {
      leaderActiveRef.current = false;
      if (leaderTimerRef.current) {
        clearTimeout(leaderTimerRef.current);
        leaderTimerRef.current = null;
      }
    }

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
        return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Si el foco está en un input, dejamos pasar todo — el usuario
      // está escribiendo. La única excepción sería Esc, pero los inputs
      // de chat ya lo manejan si quieren (blur, clear).
      if (isTypingTarget(event.target)) return;

      // Modificadores que NO usamos: cmd/meta, ctrl, alt. Si están
      // presentes, no es un atajo nuestro — dejá pasar.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Esc: cierra overlay si está abierto + cancela leader.
      // Esc se procesa SIEMPRE, incluso con help abierto — sino el
      // overlay no se podría cerrar con teclado.
      if (event.key === 'Escape') {
        cancelLeader();
        onCloseHelpRef.current();
        return;
      }

      // Con el overlay abierto cortamos acá — no queremos que `g r` o
      // Shift+P se disparen mientras el modal de ayuda está visible.
      if (helpOpenRef.current) return;

      // "?" — Shift + "/" en teclados US. event.key === '?' funciona en
      // los layouts comunes; agregamos `event.shiftKey && event.key === '/'`
      // como fallback por si algún layout reporta solo "/".
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        cancelLeader();
        onToggleHelpRef.current();
        return;
      }

      // Shift+P → modo presentación. Notar que event.key con Shift es 'P'
      // en mayúscula; matcheamos ambos por las dudas.
      if (event.shiftKey && (event.key === 'P' || event.key === 'p')) {
        event.preventDefault();
        cancelLeader();
        onTogglePresentingRef.current();
        return;
      }

      // Otras combinaciones con Shift que NO son nuestras → ignorar.
      // (Sin esto, Shift+algo entraría en la lógica del leader y
      // disparararía navegación rara.)
      if (event.shiftKey) return;

      // Segunda tecla del leader (g + x).
      if (leaderActiveRef.current) {
        const route = LEADER_ROUTES[event.key.toLowerCase()];
        cancelLeader();
        if (route) {
          event.preventDefault();
          router.push(route);
        }
        return;
      }

      // Primera tecla: 'g' arranca el leader.
      if (event.key === 'g') {
        event.preventDefault();
        leaderActiveRef.current = true;
        leaderTimerRef.current = setTimeout(cancelLeader, LEADER_TIMEOUT_MS);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelLeader();
    };
  }, [router]);
}

/**
 * Helper expuesto solo para los componentes que pintan el cheatsheet —
 * los atajos se definen en un único lugar (acá arriba) y la UI los lee.
 */
export const KEYBINDINGS_HELP: Array<{ keys: string; descriptionKey: string }> =
  [
    { keys: 'g r', descriptionKey: 'shortcuts.goto.rag' },
    { keys: 'g c', descriptionKey: 'shortcuts.goto.comparator' },
    { keys: 'g a', descriptionKey: 'shortcuts.goto.agent' },
    { keys: 'g s', descriptionKey: 'shortcuts.goto.corpus' },
    { keys: 'g h', descriptionKey: 'shortcuts.goto.home' },
    { keys: 'Shift + P', descriptionKey: 'shortcuts.presentation' },
    { keys: '?', descriptionKey: 'shortcuts.help' },
    { keys: 'Esc', descriptionKey: 'shortcuts.close' },
  ];
