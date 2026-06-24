// -----------------------------------------------------------------------------
// @org/core-banking-adapter — punto de entrada del package.
//
// Este package abstrae el sistema bancario "core" que usa la cooperativa
// para gestionar socios y préstamos. Demo 09 (ADR-0020) lo usa para
// alimentar las tools del LLM que conversa con el socio.
//
// Hoy hay un solo provider implementado (`mock`) que sirve para el demo
// y los tests. Cuando un cliente real firme, se suma su provider
// específico (Cobis, Conexus, Compac, SQL Server propio) cumpliendo la
// misma interface CoreBankingAdapter.
// -----------------------------------------------------------------------------

export type {
  CoreBankingAdapter,
  CoreBankingProvider,
  CoreLoanState,
  CoreLoanStatus,
  CreditHistory,
  LoanRequestInput,
  MemberInfo,
} from './lib/types.js';

export {
  MockCoreBankingAdapter,
  type MockCoreBankingDeps,
} from './lib/providers/mock-core-banking.js';

export {
  coreBankingFor,
  _resetCoreBankingCache,
  type CobisAdapterDeps,
  type CoreBankingDepsByProvider,
} from './lib/providers/adapter-factory.js';
