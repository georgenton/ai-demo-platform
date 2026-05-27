// -----------------------------------------------------------------------------
// Reducer puro: estado actual + un AgentEvent del SSE → nuevo estado.
//
// Responsabilidades:
//   - Acumular `token` events en un único bloque `answer` (con streaming=true
//     hasta que llegue un non-token o un `done`).
//   - Mapear los demás eventos al `kind` correspondiente.
//   - Cerrar el `answer` en curso cuando llega un evento no-token (lo
//     marca como streaming=false antes de agregar el nuevo).
//   - Quitar el `thinking` placeholder apenas llega cualquier otro evento.
//
// Función pura y sin React → testeable directo con vitest.
// -----------------------------------------------------------------------------

import type { AgentEvent } from '@/lib/api';

import type { AgentRunEvent } from './types';

/**
 * Cierra el `answer` en curso (si lo hay) — lo marca como streaming=false.
 * Retorna un array nuevo (siempre, para que React detecte el cambio).
 */
function closeOpenAnswer(state: AgentRunEvent[]): AgentRunEvent[] {
  const last = state[state.length - 1];
  if (last && last.kind === 'answer' && last.streaming) {
    return [...state.slice(0, -1), { ...last, streaming: false }];
  }
  return state;
}

/**
 * Quita el thinking placeholder si está al final.
 */
function removeThinking(state: AgentRunEvent[]): AgentRunEvent[] {
  const last = state[state.length - 1];
  if (last && last.kind === 'thinking') {
    return state.slice(0, -1);
  }
  return state;
}

/**
 * Aplica un AgentEvent del SSE al state visual y devuelve el nuevo state.
 */
export function reduceAgentEvent(
  state: AgentRunEvent[],
  event: AgentEvent,
): AgentRunEvent[] {
  // Cualquier evento del backend remueve el thinking placeholder.
  const withoutThinking = removeThinking(state);

  switch (event.type) {
    case 'token': {
      // Si el último item es un answer streameando, le append text.
      // Si no, abrimos uno nuevo.
      const last = withoutThinking[withoutThinking.length - 1];
      if (last && last.kind === 'answer' && last.streaming) {
        return [
          ...withoutThinking.slice(0, -1),
          { ...last, text: last.text + event.text },
        ];
      }
      return [
        ...withoutThinking,
        { kind: 'answer', text: event.text, streaming: true },
      ];
    }

    case 'tool_call': {
      // Cualquier non-token cierra el answer en curso.
      const closed = closeOpenAnswer(withoutThinking);
      return [...closed, { kind: 'sql', sql: event.sql }];
    }

    case 'tool_result': {
      const closed = closeOpenAnswer(withoutThinking);
      return [
        ...closed,
        {
          kind: 'result',
          rowCount: event.rowCount,
          durationMs: event.durationMs,
          preview: event.preview,
          truncated: event.truncated,
        },
      ];
    }

    case 'tool_error': {
      const closed = closeOpenAnswer(withoutThinking);
      return [...closed, { kind: 'tool_error', error: event.error }];
    }

    case 'done': {
      const closed = closeOpenAnswer(withoutThinking);
      return [
        ...closed,
        { kind: 'done', turns: event.turns, truncated: event.truncated },
      ];
    }

    case 'error': {
      const closed = closeOpenAnswer(withoutThinking);
      return [...closed, { kind: 'error', message: event.message }];
    }

    default: {
      // Defensive: si el backend agrega un evento que no manejamos, lo
      // ignoramos en vez de crashear. El compilador grita si la unión
      // cambia y no actualizamos este switch.
      const _exhaustive: never = event;
      void _exhaustive;
      return withoutThinking;
    }
  }
}
