// -----------------------------------------------------------------------------
// Tests del validador de transiciones de etapa. Lógica pura — el snapshot
// se arma a mano, no toca BD ni LLM.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  parseMoveToStageInput,
  validateStageTransition,
  type LeadStageSnapshot,
} from './move-to-stage.tool.js';

const FULL_LEAD: LeadStageSnapshot = {
  currentStage: 'lead',
  fullName: 'Test Tester',
  phone: '0999999999',
  purpose: 'consumo',
  idNumber: '0102030405',
  requestedAmount: '1000.00',
  termMonths: 12,
  lastEligibility: { eligible: true },
  coreRequestId: 'core-req-1',
};

describe('validateStageTransition', () => {
  describe('forward-only', () => {
    it('rechaza transición que salta etapas', () => {
      const r = validateStageTransition(FULL_LEAD, 'credit_evaluation');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/avanzar una etapa a la vez/);
    });

    it('rechaza backwards (no permitido en sub-PR 2)', () => {
      const r = validateStageTransition(
        { ...FULL_LEAD, currentStage: 'documentation' },
        'qualification',
      );
      expect(r.ok).toBe(false);
    });
  });

  describe('criterios por etapa', () => {
    it('lead → qualification requiere fullName/phone/purpose', () => {
      const r = validateStageTransition(
        { ...FULL_LEAD, fullName: '' },
        'qualification',
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/register_lead/);
    });

    it('lead → qualification con datos completos → ok', () => {
      const r = validateStageTransition(FULL_LEAD, 'qualification');
      expect(r.ok).toBe(true);
    });

    it('qualification → documentation requiere monto y plazo', () => {
      const r = validateStageTransition(
        {
          ...FULL_LEAD,
          currentStage: 'qualification',
          requestedAmount: null,
        },
        'documentation',
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/monto solicitado/);
    });

    it('documentation → credit_evaluation requiere cédula', () => {
      const r = validateStageTransition(
        {
          ...FULL_LEAD,
          currentStage: 'documentation',
          idNumber: null,
        },
        'credit_evaluation',
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/cédula/);
    });

    it('credit_evaluation → approval requiere eligibility.eligible=true', () => {
      const r = validateStageTransition(
        {
          ...FULL_LEAD,
          currentStage: 'credit_evaluation',
          lastEligibility: { eligible: false },
        },
        'approval',
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/no fue elegible/);
    });

    it('credit_evaluation → approval con elegibility ok → ok', () => {
      const r = validateStageTransition(
        { ...FULL_LEAD, currentStage: 'credit_evaluation' },
        'approval',
      );
      expect(r.ok).toBe(true);
    });

    it('approval → disbursement requiere coreRequestId', () => {
      const r = validateStageTransition(
        {
          ...FULL_LEAD,
          currentStage: 'approval',
          coreRequestId: null,
        },
        'disbursement',
      );
      expect(r.ok).toBe(false);
    });
  });

  describe('rejected (terminal)', () => {
    it('cualquier etapa activa → rejected es válido', () => {
      const r = validateStageTransition(
        { ...FULL_LEAD, currentStage: 'qualification' },
        'rejected',
      );
      expect(r.ok).toBe(true);
    });

    it('rejected → rejected no se permite', () => {
      const r = validateStageTransition(
        { ...FULL_LEAD, currentStage: 'rejected' },
        'rejected',
      );
      expect(r.ok).toBe(false);
    });
  });
});

describe('parseMoveToStageInput', () => {
  it('rechaza toStage inválido', () => {
    const r = parseMoveToStageInput({ toStage: 'unknown', reason: 'test ok' });
    expect(r).toEqual({ error: expect.stringMatching(/toStage/) });
  });

  it('rechaza reason vacío o corto', () => {
    const r = parseMoveToStageInput({ toStage: 'qualification', reason: 'no' });
    expect(r).toEqual({ error: expect.stringMatching(/reason/) });
  });

  it('acepta input válido', () => {
    const r = parseMoveToStageInput({
      toStage: 'qualification',
      reason: 'datos completos del socio confirmados',
    });
    expect(r).not.toHaveProperty('error');
  });
});
