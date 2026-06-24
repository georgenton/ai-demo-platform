// -----------------------------------------------------------------------------
// MockCoreBankingAdapter (ADR-0020, sub-PR 1).
//
// Implementación in-memory del CoreBankingAdapter. Tiene 4 socios
// sembrados con perfiles distintos (buen score, score borderline, sin
// historial, con préstamo activo) para que el demo cubra los caminos
// típicos del funnel sin red real ni datos de prueba escondidos.
//
// Estado:
//   - `members`: tabla de socios indexada por cédula.
//   - `loanRequests`: solicitudes creadas durante la sesión, indexadas
//     por requestId que generamos.
//
// El estado vive en el constructor; cada nuevo MockCoreBankingAdapter
// arranca con los seed members + un Map vacío de loanRequests. Para el
// demo, el LoansModule mantiene una instancia singleton vía DI, así que
// las solicitudes creadas durante la presentación persisten entre
// requests del mismo proceso (no entre restarts del server — eso es OK
// para un demo).
// -----------------------------------------------------------------------------

import type {
  CoreBankingAdapter,
  CoreLoanState,
  CoreLoanStatus,
  CreditHistory,
  LoanRequestInput,
  MemberInfo,
} from '../types.js';

/**
 * Configuración opcional del mock. Permite a los tests sobrescribir el
 * generador de requestId para tener fixtures determinísticos.
 */
export interface MockCoreBankingDeps {
  /**
   * Generador de ids para nuevas solicitudes. Default: incrementa un
   * contador y devuelve `core-req-N`. Tests pueden inyectar uno custom.
   */
  generateRequestId?: () => string;
  /**
   * Override de la fecha "ahora". Útil para tests que validan
   * `disbursedAt` o cálculos de cooldown.
   */
  now?: () => Date;
}

/**
 * 4 socios sembrados con perfiles distintos. Cédulas ecuatorianas reales
 * en formato (sintéticas — no pertenecen a personas reales, validadas
 * con el algoritmo de checksum nacional para que pasen validaciones).
 */
const SEEDED_MEMBERS: ReadonlyArray<{
  info: MemberInfo;
  history: CreditHistory;
}> = [
  {
    info: {
      memberId: 'mem-001',
      fullName: 'María Elena Pacheco Salazar',
      idNumber: '0102030405',
      joinedAt: new Date('2020-03-15'),
      shareCapital: '450.00',
      hasActiveLoan: false,
    },
    history: {
      internalScore: 780,
      monthlyIncome: '1450.00',
      monthlyDebt: '180.00',
      lastLoanClosedAt: new Date('2025-08-10'),
    },
  },
  {
    info: {
      memberId: 'mem-002',
      fullName: 'Carlos Andrés Yánez Vargas',
      idNumber: '0203040506',
      joinedAt: new Date('2022-09-22'),
      shareCapital: '120.00',
      hasActiveLoan: false,
    },
    history: {
      // Borderline — la tool calculateLoanEligibility debería dar
      // "elegible solo para montos chicos" o "contra-oferta".
      internalScore: 580,
      monthlyIncome: '780.00',
      monthlyDebt: '290.00',
      lastLoanClosedAt: null,
    },
  },
  {
    info: {
      memberId: 'mem-003',
      fullName: 'Ana Lucía Tipán Pilco',
      idNumber: '0304050607',
      joinedAt: new Date('2024-11-05'),
      shareCapital: '25.00',
      hasActiveLoan: false,
    },
    history: {
      // Socio nuevo, sin historial. Score promedio por defecto.
      internalScore: 500,
      monthlyIncome: '950.00',
      monthlyDebt: '50.00',
      lastLoanClosedAt: null,
    },
  },
  {
    info: {
      memberId: 'mem-004',
      fullName: 'Luis Fernando Chimbo Quishpe',
      idNumber: '0405060708',
      joinedAt: new Date('2018-01-30'),
      shareCapital: '820.00',
      hasActiveLoan: true,
    },
    history: {
      internalScore: 850,
      monthlyIncome: '2200.00',
      monthlyDebt: '410.00',
      lastLoanClosedAt: new Date('2024-02-15'),
    },
  },
];

export class MockCoreBankingAdapter implements CoreBankingAdapter {
  private readonly membersByIdNumber = new Map<string, MemberInfo>();
  private readonly historyByMemberId = new Map<string, CreditHistory>();
  private readonly loanRequests = new Map<string, CoreLoanState>();
  private readonly generateRequestId: () => string;
  private readonly now: () => Date;
  private counter = 0;

  constructor(deps: MockCoreBankingDeps = {}) {
    for (const seed of SEEDED_MEMBERS) {
      this.membersByIdNumber.set(seed.info.idNumber, seed.info);
      this.historyByMemberId.set(seed.info.memberId, seed.history);
    }
    this.generateRequestId =
      deps.generateRequestId ??
      (() => {
        this.counter += 1;
        return `core-req-${this.counter}`;
      });
    this.now = deps.now ?? (() => new Date());
  }

  async verifyMember(input: { idNumber: string }): Promise<MemberInfo | null> {
    if (!input.idNumber) return null;
    return this.membersByIdNumber.get(input.idNumber) ?? null;
  }

  async getCreditHistory(memberId: string): Promise<CreditHistory> {
    const h = this.historyByMemberId.get(memberId);
    if (!h) {
      throw new Error(
        `MockCoreBankingAdapter.getCreditHistory: memberId "${memberId}" no existe en el core.`,
      );
    }
    return h;
  }

  async createLoanRequest(
    input: LoanRequestInput,
  ): Promise<{ requestId: string }> {
    if (!this.historyByMemberId.has(input.memberId)) {
      throw new Error(
        `MockCoreBankingAdapter.createLoanRequest: memberId "${input.memberId}" no existe en el core.`,
      );
    }
    const requestId = this.generateRequestId();
    this.loanRequests.set(requestId, {
      requestId,
      status: 'pending',
      approvedAmount: null,
      approvedRate: null,
      disbursedAt: null,
      notes: null,
    });
    return { requestId };
  }

  async getLoanRequest(requestId: string): Promise<CoreLoanState | null> {
    return this.loanRequests.get(requestId) ?? null;
  }

  async updateLoanRequest(input: {
    requestId: string;
    status: CoreLoanStatus;
    notes?: string;
  }): Promise<void> {
    const existing = this.loanRequests.get(input.requestId);
    if (!existing) {
      throw new Error(
        `MockCoreBankingAdapter.updateLoanRequest: requestId "${input.requestId}" no existe.`,
      );
    }
    const next: CoreLoanState = {
      ...existing,
      status: input.status,
      notes: input.notes ?? existing.notes,
    };
    if (input.status === 'disbursed' && !existing.disbursedAt) {
      next.disbursedAt = this.now();
    }
    this.loanRequests.set(input.requestId, next);
  }
}
