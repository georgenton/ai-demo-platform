// Tests del reducer de eventos del agente.
// Cubre los caminos no triviales: acumulación de tokens, cierre de answer
// cuando llega non-token, multi-vuelta (token → tool_call → token).

import { describe, expect, it } from 'vitest';

import { reduceAgentEvent } from './agent-events-reducer';
import type { AgentRunEvent } from './types';

describe('reduceAgentEvent', () => {
  describe('token accumulation', () => {
    it('crea un answer streaming cuando llega el primer token', () => {
      const state: AgentRunEvent[] = [{ kind: 'question', text: '¿?' }];
      const next = reduceAgentEvent(state, { type: 'token', text: 'Hola' });
      expect(next).toEqual([
        { kind: 'question', text: '¿?' },
        { kind: 'answer', text: 'Hola', streaming: true },
      ]);
    });

    it('appendea tokens al mismo answer mientras siga abierto', () => {
      let state: AgentRunEvent[] = [];
      state = reduceAgentEvent(state, { type: 'token', text: 'Hay ' });
      state = reduceAgentEvent(state, { type: 'token', text: '8472 ' });
      state = reduceAgentEvent(state, { type: 'token', text: 'estudiantes.' });
      expect(state).toEqual([
        { kind: 'answer', text: 'Hay 8472 estudiantes.', streaming: true },
      ]);
    });

    it('un non-token cierra el answer en curso (streaming=false)', () => {
      let state: AgentRunEvent[] = [];
      state = reduceAgentEvent(state, {
        type: 'token',
        text: 'Voy a consultar.',
      });
      state = reduceAgentEvent(state, {
        type: 'tool_call',
        sql: 'SELECT 1',
      });
      expect(state).toEqual([
        { kind: 'answer', text: 'Voy a consultar.', streaming: false },
        { kind: 'sql', sql: 'SELECT 1' },
      ]);
    });

    it('multi-vuelta: token → tool_call → result → token abre OTRO answer', () => {
      let state: AgentRunEvent[] = [];
      state = reduceAgentEvent(state, { type: 'token', text: 'Voy.' });
      state = reduceAgentEvent(state, { type: 'tool_call', sql: 'SELECT 1' });
      state = reduceAgentEvent(state, {
        type: 'tool_result',
        rowCount: 1,
        durationMs: 12,
        preview: [{ x: 1 }],
        truncated: false,
      });
      state = reduceAgentEvent(state, { type: 'token', text: 'Listo' });

      expect(state).toEqual([
        { kind: 'answer', text: 'Voy.', streaming: false },
        { kind: 'sql', sql: 'SELECT 1' },
        {
          kind: 'result',
          rowCount: 1,
          durationMs: 12,
          preview: [{ x: 1 }],
          truncated: false,
        },
        { kind: 'answer', text: 'Listo', streaming: true },
      ]);
    });
  });

  describe('thinking removal', () => {
    it('elimina el thinking placeholder cuando llega un evento real', () => {
      const state: AgentRunEvent[] = [
        { kind: 'question', text: '¿?' },
        { kind: 'thinking' },
      ];
      const next = reduceAgentEvent(state, { type: 'token', text: 'foo' });
      expect(next).toEqual([
        { kind: 'question', text: '¿?' },
        { kind: 'answer', text: 'foo', streaming: true },
      ]);
    });
  });

  describe('mapping de eventos', () => {
    it('tool_call → sql', () => {
      const next = reduceAgentEvent([], { type: 'tool_call', sql: 'SELECT *' });
      expect(next).toEqual([{ kind: 'sql', sql: 'SELECT *' }]);
    });

    it('tool_result → result con todos los campos', () => {
      const next = reduceAgentEvent([], {
        type: 'tool_result',
        rowCount: 5,
        durationMs: 20,
        preview: [{ a: 1 }, { a: 2 }],
        truncated: true,
      });
      expect(next).toEqual([
        {
          kind: 'result',
          rowCount: 5,
          durationMs: 20,
          preview: [{ a: 1 }, { a: 2 }],
          truncated: true,
        },
      ]);
    });

    it('tool_error → tool_error', () => {
      const next = reduceAgentEvent([], {
        type: 'tool_error',
        error: 'tabla no permitida',
      });
      expect(next).toEqual([
        { kind: 'tool_error', error: 'tabla no permitida' },
      ]);
    });

    it('done → done', () => {
      const next = reduceAgentEvent([], {
        type: 'done',
        turns: 2,
        truncated: false,
      });
      expect(next).toEqual([{ kind: 'done', turns: 2, truncated: false }]);
    });

    it('error → error', () => {
      const next = reduceAgentEvent([], {
        type: 'error',
        message: 'LLM caído',
      });
      expect(next).toEqual([{ kind: 'error', message: 'LLM caído' }]);
    });
  });

  describe('inmutabilidad', () => {
    it('siempre devuelve un array nuevo (referencia distinta)', () => {
      const state: AgentRunEvent[] = [{ kind: 'question', text: '?' }];
      const next = reduceAgentEvent(state, { type: 'token', text: 'a' });
      expect(next).not.toBe(state);
    });
  });
});
