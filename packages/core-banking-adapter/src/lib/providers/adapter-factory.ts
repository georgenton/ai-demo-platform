// -----------------------------------------------------------------------------
// Factory del CoreBankingAdapter (ADR-0020, sub-PR 1).
//
// Resuelve el provider correcto según `CORE_BANKING_PROVIDER`. Hoy solo
// existe 'mock'; 'cobis' es stub. El caller (LoansModule en sub-PR 2)
// usa `coreBankingFor()` para obtener la implementación sin tocar nada
// específico del provider.
// -----------------------------------------------------------------------------

import type {
  CoreBankingAdapter,
  CoreBankingProvider,
  CoreLoanState,
  CoreLoanStatus,
  CreditHistory,
  LoanRequestInput,
  MemberInfo,
} from '../types.js';

import {
  MockCoreBankingAdapter,
  type MockCoreBankingDeps,
} from './mock-core-banking.js';

/**
 * Deps por provider. Cada implementación que se sume acá define qué
 * dependencias inyectarle. Mantiene tipos seguros — pedir un mock con
 * deps de cobis tira error de compilación.
 */
export interface CoreBankingDepsByProvider {
  mock: MockCoreBankingDeps;
  cobis: CobisAdapterDeps;
}

/**
 * Stub de deps de Cobis. Cuando un cliente real firme, se completa
 * acá (endpoint, token, etc).
 */
export interface CobisAdapterDeps {
  baseUrl: string;
  apiKey: string;
}

/**
 * Cache de instancias por provider. Mismo razonamiento que en
 * notaryFor() del NotaryAdapter: el mock es stateful (mantiene
 * loanRequests creadas en sesión), así que dos calls al factory dentro
 * del mismo proceso deben devolver la MISMA instancia.
 *
 * En tests donde se requiera resetear el estado, instanciar
 * MockCoreBankingAdapter directamente.
 */
const instanceCache = new Map<CoreBankingProvider, CoreBankingAdapter>();

/**
 * Resuelve el adapter del provider pedido. Idempotente — la segunda
 * llamada con el mismo provider devuelve la misma instancia.
 */
export function coreBankingFor<P extends CoreBankingProvider>(
  provider: P,
  deps: CoreBankingDepsByProvider[P],
): CoreBankingAdapter {
  const cached = instanceCache.get(provider);
  if (cached) return cached;

  let adapter: CoreBankingAdapter;
  switch (provider) {
    case 'mock':
      adapter = new MockCoreBankingAdapter(deps as MockCoreBankingDeps);
      break;
    case 'cobis':
      // Sub-PR futuro — cuando el cliente real firme. Devolvemos un
      // adapter "broken" que lanza al usarse, paralelo al patrón del
      // notary-adapter.
      adapter = brokenCobis();
      break;
    default: {
      const _exhaustive: never = provider;
      throw new Error(
        `coreBankingFor: provider desconocido "${String(_exhaustive)}".`,
      );
    }
  }
  instanceCache.set(provider, adapter);
  return adapter;
}

/**
 * Limpia el cache. Útil en tests entre suites. NO debería invocarse
 * en runtime.
 */
export function _resetCoreBankingCache(): void {
  instanceCache.clear();
}

function brokenCobis(): CoreBankingAdapter {
  const notImpl = () => {
    throw new Error(
      'CobisAdapter aún no implementado. Sumar provider en sub-PR futuro.',
    );
  };
  return {
    async verifyMember(_input: {
      idNumber: string;
    }): Promise<MemberInfo | null> {
      void _input;
      return notImpl();
    },
    async getCreditHistory(_memberId: string): Promise<CreditHistory> {
      void _memberId;
      return notImpl();
    },
    async createLoanRequest(
      _input: LoanRequestInput,
    ): Promise<{ requestId: string }> {
      void _input;
      return notImpl();
    },
    async getLoanRequest(_requestId: string): Promise<CoreLoanState | null> {
      void _requestId;
      return notImpl();
    },
    async updateLoanRequest(_input: {
      requestId: string;
      status: CoreLoanStatus;
      notes?: string;
    }): Promise<void> {
      void _input;
      return notImpl();
    },
  };
}
