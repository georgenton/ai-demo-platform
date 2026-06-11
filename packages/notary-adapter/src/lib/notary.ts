// -----------------------------------------------------------------------------
// NotaryAdapter — singleton + factory por provider.
//
// Espejo del patrón de chat.ts / embeddings.ts del llm-adapter:
//
//   - `createNotaryAdapter(provider, deps)` instancia un adapter concreto.
//   - `notaryFor(provider, deps)` cachea instancias en un Map para reuso
//     entre requests.
//
// Diferencia importante con llm-adapter: cada provider tiene dependencias
// distintas (BD para local, ethers signer para polygon), así que el caller
// pasa las deps al instanciar. No hay "singleton del env" auto-construido
// — el NotarizationService del sub-PR 4 las arma desde el DI de NestJS.
//
// Ver ADR-0019 para el porqué del adapter pattern.
// -----------------------------------------------------------------------------

import { FakeNotaryAdapter } from './providers/fake-notary.js';
import {
  LocalNotaryAdapter,
  type LocalNotaryDeps,
} from './providers/local-notary.js';
import {
  PolygonNotaryAdapter,
  type PolygonNotaryDeps,
} from './providers/polygon-notary.js';
import type { NotaryAdapter, NotaryProvider } from './types.js';

/** Set de providers válidos — espejo del union `NotaryProvider`. */
const VALID_PROVIDERS: ReadonlySet<NotaryProvider> = new Set([
  'local',
  'polygon',
  'fake',
]);

/**
 * Type guard para validar un string suelto (ej. valor de un body HTTP)
 * contra el union `NotaryProvider`. Devuelve `false` si no matchea.
 */
export function isValidNotaryProvider(s: string): s is NotaryProvider {
  return VALID_PROVIDERS.has(s as NotaryProvider);
}

/**
 * Deps unificadas. Cada provider concreto extrae las suyas:
 *   - `local`: necesita { db, masterKey } (sub-PR 2).
 *   - `polygon`: necesita { signer, network } (sub-PR 3).
 *   - `fake`: no necesita nada.
 *
 * El service (sub-PR 4) arma las tres y se las pasa todas; cada adapter
 * usa la que le sirve.
 */
export interface NotaryDeps {
  local?: LocalNotaryDeps;
  polygon?: PolygonNotaryDeps;
}

/**
 * Crea la implementación concreta del NotaryAdapter según el provider.
 * Sub-PR 1 deja `local` y `polygon` como stubs que lanzan "no implementado"
 * — implementación real en sub-PRs 2 y 3 respectivamente.
 */
export function createNotaryAdapter(
  provider: NotaryProvider,
  deps: NotaryDeps = {},
): NotaryAdapter {
  switch (provider) {
    case 'local':
      if (!deps.local) {
        throw new Error(
          'createNotaryAdapter(local): faltan deps.local. Pasar { db, masterKey }.',
        );
      }
      return new LocalNotaryAdapter(deps.local);
    case 'polygon':
      if (!deps.polygon) {
        throw new Error(
          'createNotaryAdapter(polygon): faltan deps.polygon. Pasar { signer, network }.',
        );
      }
      return new PolygonNotaryAdapter(deps.polygon);
    case 'fake':
      return new FakeNotaryAdapter();
    default: {
      // Exhaustiveness check — si agregamos un provider al union y olvidamos
      // manejarlo acá, TypeScript marca este caso como error en compilación.
      const _exhaustive: never = provider;
      throw new Error(`Provider no manejado: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Cache de instancias por provider.
//
// La key del cache es solo el provider name — asumimos que las deps no
// cambian entre requests del mismo proceso (mismo signer Polygon, mismo
// cliente Prisma). Si en el futuro alguien necesita varios signers en
// paralelo (multi-wallet), promover la key a un objeto compuesto.
// ---------------------------------------------------------------------------

const _byProvider = new Map<NotaryProvider, NotaryAdapter>();

/**
 * Devuelve el NotaryAdapter para un provider específico, cacheando entre
 * llamadas. La primera llamada con un provider dado instancia; las
 * siguientes con el MISMO provider devuelven la instancia cacheada
 * (las deps que se pasen en llamadas posteriores se ignoran).
 *
 * Para limpiar el cache (tests), ver `resetNotaryCache`.
 */
export function notaryFor(
  provider: NotaryProvider,
  deps: NotaryDeps = {},
): NotaryAdapter {
  const cached = _byProvider.get(provider);
  if (cached) return cached;
  const adapter = createNotaryAdapter(provider, deps);
  _byProvider.set(provider, adapter);
  return adapter;
}

/**
 * Limpia el cache de instancias. Útil en tests entre casos para evitar que
 * un mock se filtre del test anterior. NO usar en producción.
 */
export function resetNotaryCache(): void {
  _byProvider.clear();
}
