// API pública del paquete @org/notary-adapter (ADR-0019).
//
// Se expone la interfaz + el factory + los tres providers. El singleton
// del env (como en chat.ts / embeddings.ts) NO se incluye porque las deps
// dependen de NestJS DI; el NotarizationService del sub-PR 4 arma las
// instancias localmente.

export {
  createNotaryAdapter,
  isValidNotaryProvider,
  notaryFor,
  resetNotaryCache,
  type NotaryDeps,
} from './lib/notary.js';

export type {
  AnchorRequest,
  AnchorResult,
  NotaryAdapter,
  NotaryConfig,
  NotaryProvider,
  VerificationResult,
} from './lib/types.js';

export { FakeNotaryAdapter } from './lib/providers/fake-notary.js';
export {
  LocalNotaryAdapter,
  type LocalNotaryDeps,
  type LocalNotaryDb,
  type LocalAnchorRecord,
  type TenantNotaryKeyRecord,
} from './lib/providers/local-notary.js';
export {
  PolygonNotaryAdapter,
  type PolygonNotaryDeps,
  type PolygonNetwork,
  type PolygonSigner,
  type PolygonProvider,
  type PolygonOnchainTx,
  type PolygonTxRequest,
  type PolygonTxResponse,
  type PolygonTxReceipt,
} from './lib/providers/polygon-notary.js';
