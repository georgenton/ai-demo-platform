// -----------------------------------------------------------------------------
// Tests del MockCoreBankingAdapter (sub-PR 1).
//
// Cubrimos:
//   - Los 4 socios sembrados están disponibles vía verifyMember.
//   - Cédula que no existe → null sin lanzar.
//   - getCreditHistory devuelve datos consistentes con los seeds.
//   - getCreditHistory lanza si el memberId no existe (defensa).
//   - createLoanRequest genera un requestId y persiste estado 'pending'.
//   - createLoanRequest con memberId inexistente → lanza.
//   - updateLoanRequest cambia el status y stampa disbursedAt si pasa
//     a 'disbursed'.
//   - updateLoanRequest sobre requestId inexistente → lanza.
//   - El factory cachea instancias del mismo provider.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';

import { _resetCoreBankingCache, coreBankingFor } from './adapter-factory.js';
import { MockCoreBankingAdapter } from './mock-core-banking.js';

describe('MockCoreBankingAdapter', () => {
  let mock: MockCoreBankingAdapter;
  beforeEach(() => {
    mock = new MockCoreBankingAdapter({
      now: () => new Date('2026-06-23T00:00:00Z'),
    });
  });

  describe('verifyMember', () => {
    it('encuentra los 4 socios sembrados por cédula', async () => {
      const m1 = await mock.verifyMember({ idNumber: '0102030405' });
      const m2 = await mock.verifyMember({ idNumber: '0203040506' });
      const m3 = await mock.verifyMember({ idNumber: '0304050607' });
      const m4 = await mock.verifyMember({ idNumber: '0405060708' });
      expect(m1?.fullName).toMatch(/María Elena Pacheco/);
      expect(m2?.fullName).toMatch(/Carlos Andrés Yánez/);
      expect(m3?.fullName).toMatch(/Ana Lucía Tipán/);
      expect(m4?.fullName).toMatch(/Luis Fernando Chimbo/);
    });

    it('devuelve null si la cédula no existe', async () => {
      const m = await mock.verifyMember({ idNumber: '9999999999' });
      expect(m).toBeNull();
    });

    it('devuelve null si la cédula es vacía', async () => {
      const m = await mock.verifyMember({ idNumber: '' });
      expect(m).toBeNull();
    });

    it('los socios sembrados tienen los perfiles esperados', async () => {
      const buenScore = await mock.verifyMember({ idNumber: '0102030405' });
      expect(buenScore?.hasActiveLoan).toBe(false);
      expect(buenScore?.shareCapital).toBe('450.00');

      const conPrestamoActivo = await mock.verifyMember({
        idNumber: '0405060708',
      });
      expect(conPrestamoActivo?.hasActiveLoan).toBe(true);
    });
  });

  describe('getCreditHistory', () => {
    it('devuelve el historial consistente con los seeds', async () => {
      const h = await mock.getCreditHistory('mem-001');
      expect(h.internalScore).toBe(780);
      expect(h.monthlyIncome).toBe('1450.00');
      expect(h.lastLoanClosedAt).toBeInstanceOf(Date);
    });

    it('socio nuevo sin historial → lastLoanClosedAt null', async () => {
      const h = await mock.getCreditHistory('mem-003');
      expect(h.lastLoanClosedAt).toBeNull();
      expect(h.internalScore).toBe(500); // default para nuevos
    });

    it('lanza si el memberId no existe', async () => {
      await expect(mock.getCreditHistory('mem-fantasma')).rejects.toThrow(
        /no existe en el core/,
      );
    });
  });

  describe('createLoanRequest', () => {
    it('genera requestId secuencial y persiste el estado pending', async () => {
      const r1 = await mock.createLoanRequest({
        memberId: 'mem-001',
        amountUsd: '2000.00',
        termMonths: 12,
        purpose: 'capital de trabajo',
        annualInterestRate: 14.5,
      });
      const r2 = await mock.createLoanRequest({
        memberId: 'mem-002',
        amountUsd: '500.00',
        termMonths: 6,
        purpose: 'emergencia médica',
        annualInterestRate: 16,
      });
      expect(r1.requestId).toMatch(/^core-req-1$/);
      expect(r2.requestId).toMatch(/^core-req-2$/);

      const state1 = await mock.getLoanRequest(r1.requestId);
      expect(state1?.status).toBe('pending');
      expect(state1?.disbursedAt).toBeNull();
    });

    it('lanza si el memberId no existe', async () => {
      await expect(
        mock.createLoanRequest({
          memberId: 'mem-fantasma',
          amountUsd: '100',
          termMonths: 12,
          purpose: '',
          annualInterestRate: 14,
        }),
      ).rejects.toThrow(/no existe en el core/);
    });

    it('respeta un generateRequestId custom (para tests fixture)', async () => {
      const custom = new MockCoreBankingAdapter({
        generateRequestId: () => 'fixed-id',
      });
      const r = await custom.createLoanRequest({
        memberId: 'mem-001',
        amountUsd: '100',
        termMonths: 6,
        purpose: '',
        annualInterestRate: 14,
      });
      expect(r.requestId).toBe('fixed-id');
    });
  });

  describe('updateLoanRequest', () => {
    it('cambia status y persiste notas', async () => {
      const r = await mock.createLoanRequest({
        memberId: 'mem-001',
        amountUsd: '1000',
        termMonths: 12,
        purpose: 'test',
        annualInterestRate: 14,
      });
      await mock.updateLoanRequest({
        requestId: r.requestId,
        status: 'approved',
        notes: 'monto aprobado completo',
      });
      const state = await mock.getLoanRequest(r.requestId);
      expect(state?.status).toBe('approved');
      expect(state?.notes).toBe('monto aprobado completo');
    });

    it('al pasar a "disbursed" stampa disbursedAt con el now() inyectado', async () => {
      const r = await mock.createLoanRequest({
        memberId: 'mem-001',
        amountUsd: '1000',
        termMonths: 12,
        purpose: 'test',
        annualInterestRate: 14,
      });
      await mock.updateLoanRequest({
        requestId: r.requestId,
        status: 'disbursed',
      });
      const state = await mock.getLoanRequest(r.requestId);
      expect(state?.disbursedAt?.toISOString()).toBe(
        '2026-06-23T00:00:00.000Z',
      );
    });

    it('no sobrescribe disbursedAt si ya estaba seteado', async () => {
      const r = await mock.createLoanRequest({
        memberId: 'mem-001',
        amountUsd: '1000',
        termMonths: 12,
        purpose: 'test',
        annualInterestRate: 14,
      });
      await mock.updateLoanRequest({
        requestId: r.requestId,
        status: 'disbursed',
      });
      const first = (await mock.getLoanRequest(r.requestId))?.disbursedAt;
      // Update posterior a 'active' no debe cambiar disbursedAt.
      await mock.updateLoanRequest({
        requestId: r.requestId,
        status: 'active',
      });
      const second = (await mock.getLoanRequest(r.requestId))?.disbursedAt;
      expect(second).toEqual(first);
    });

    it('lanza si el requestId no existe', async () => {
      await expect(
        mock.updateLoanRequest({
          requestId: 'no-existe',
          status: 'approved',
        }),
      ).rejects.toThrow(/no existe/);
    });
  });

  describe('getLoanRequest', () => {
    it('devuelve null si el requestId no existe', async () => {
      const state = await mock.getLoanRequest('no-existe');
      expect(state).toBeNull();
    });
  });
});

describe('coreBankingFor (factory)', () => {
  beforeEach(() => {
    _resetCoreBankingCache();
  });

  it('cachea la instancia del mismo provider entre calls', async () => {
    const a = coreBankingFor('mock', {});
    const b = coreBankingFor('mock', {});
    expect(a).toBe(b);
  });

  it('mock cacheado mantiene estado entre calls al factory', async () => {
    const adapter = coreBankingFor('mock', {}) as MockCoreBankingAdapter;
    const r = await adapter.createLoanRequest({
      memberId: 'mem-001',
      amountUsd: '500',
      termMonths: 6,
      purpose: '',
      annualInterestRate: 14,
    });
    const sameAdapter = coreBankingFor('mock', {});
    const state = await sameAdapter.getLoanRequest(r.requestId);
    expect(state?.status).toBe('pending');
  });

  it('provider cobis devuelve adapter "broken" que lanza al usarse', async () => {
    const cobis = coreBankingFor('cobis', {
      baseUrl: 'http://example.com',
      apiKey: 'k',
    });
    await expect(cobis.verifyMember({ idNumber: '123' })).rejects.toThrow(
      /aún no implementado/,
    );
  });
});
