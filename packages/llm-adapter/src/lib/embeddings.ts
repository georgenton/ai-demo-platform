// -----------------------------------------------------------------------------
// EmbeddingsAdapter singleton + factory por provider (switch dinámico).
//
// Espejo de chat.ts pero para embeddings. Dos caminos coexistiendo:
//
//   1. Singleton legacy `embeddings.embed(text)`:
//      Lee `EMBEDDINGS_PROVIDER` del env al primer uso, instancia el adapter
//      correspondiente y lo cachea. Compatibilidad hacia atrás 100%: TODAS
//      las llamadas viejas siguen funcionando idénticas.
//
//   2. Override por provider `embeddings.embed(text, { provider })`:
//      Cuando el caller especifica `provider`, usamos el adapter de ese
//      provider (instanciado y cacheado en un Map). Es lo que ChatService /
//      IngestService usan al recibir el provider del header `X-LLM-Provider`
//      vía el decorator `@CurrentLlmProvider()` (apps/api).
//
// Lazy: importar este módulo NO falla si faltan env vars. Falla recién cuando
// se llama a un método del singleton. Esto permite que los tests importen
// tipos del package sin tener el entorno configurado.
//
// Ver ADR-0018 para el reasoning de por qué hoy solo soportamos embeddings
// on-prem (private-mac) en runtime — los demás providers existen como
// posibilidad técnica pero el demo bloquea las llamadas si el chat provider
// activo es anthropic (no tiene embeddings).
// -----------------------------------------------------------------------------

import { FakeEmbeddingsAdapter } from './providers/fake-embeddings.js';
import { OpenAIEmbeddingsAdapter } from './providers/openai-embeddings.js';
import { PrivateMacEmbeddingsAdapter } from './providers/private-mac-embeddings.js';
import type {
  ChatProvider,
  EmbeddingsAdapter,
  EmbeddingsConfig,
  EmbeddingsProvider,
} from './types.js';

/** Set de providers válidos — espejo del union `EmbeddingsProvider`. */
const VALID_PROVIDERS: ReadonlySet<EmbeddingsProvider> = new Set([
  'openai',
  'openai-compat',
  'private-mac',
  'fake',
]);

/**
 * Type guard para validar un string suelto (ej. valor de un header HTTP)
 * contra el union `EmbeddingsProvider`. Devuelve `false` si el string no
 * matchea ningún provider conocido.
 */
export function isValidEmbeddingsProvider(s: string): s is EmbeddingsProvider {
  return VALID_PROVIDERS.has(s as EmbeddingsProvider);
}

/**
 * Dimensión default por provider, usada si `EMBEDDINGS_DIM` no está en el
 * env. Refleja los modelos canónicos del proyecto:
 *
 *   - openai / openai-compat → 1536 (text-embedding-3-small).
 *   - private-mac            → 768  (nomic-embed-text servido por NAI,
 *                                    ver ADR-0018).
 *   - fake                   → 768  (FakeEmbeddingsAdapter post sub-PR 1).
 *
 * Si en algún despliegue se sirve un modelo con otra dim (ej.
 * `bge-large-en-v1.5` con 1024), el operador puede setear `EMBEDDINGS_DIM`
 * en el env y este default queda overridado.
 */
const DEFAULT_DIMS: Record<EmbeddingsProvider, number> = {
  openai: 1536,
  'openai-compat': 1536,
  'private-mac': 768,
  fake: 768,
};

/**
 * Mapea un `ChatProvider` al `EmbeddingsProvider` que le corresponde. Si el
 * chat provider no tiene embeddings (caso `anthropic` — Anthropic no
 * fabrica un endpoint de embeddings), devuelve `null` y el caller decide
 * qué hacer (típicamente: rechazar con 400 al cliente).
 *
 * Esta función vive acá (en el package) y no en cada service para que el
 * mapping sea único — si mañana se agrega `voyage` como embeddings provider
 * de `anthropic`, solo hay un lugar que tocar.
 */
export function resolveEmbeddingsProvider(
  chat: ChatProvider,
): EmbeddingsProvider | null {
  switch (chat) {
    case 'private-mac':
      return 'private-mac';
    case 'openai-compat':
      return 'openai-compat';
    case 'fake':
      return 'fake';
    case 'anthropic':
      // Anthropic no expone embeddings. El caller debe manejar este `null`
      // con un BadRequest hacia el cliente (ver ChatService / IngestService).
      return null;
    default: {
      const _exhaustive: never = chat;
      throw new Error(
        `ChatProvider no manejado en resolveEmbeddingsProvider: ${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Lee las env vars de embeddings y arma un EmbeddingsConfig validado.
 * Lanza si falta algo obligatorio o si los valores son inválidos.
 *
 * Caso especial `EMBEDDINGS_PROVIDER=fake`: el adapter es totalmente
 * determinístico y no llama a ningún proveedor real, así que API key /
 * modelo / baseUrl son **opcionales**. Permite arrancar en CI o tests E2E
 * sin necesidad de configurar secretos.
 */
export function readEmbeddingsConfig(): EmbeddingsConfig {
  const provider = process.env.EMBEDDINGS_PROVIDER;
  if (!provider) {
    throw new Error('EMBEDDINGS_PROVIDER no está definida en el entorno.');
  }
  if (!isValidEmbeddingsProvider(provider)) {
    throw new Error(
      `EMBEDDINGS_PROVIDER inválido: "${provider}". Esperado: 'openai', 'openai-compat', 'private-mac' o 'fake'.`,
    );
  }
  return readConfigFor(provider);
}

/**
 * Arma un EmbeddingsConfig para un provider arbitrario (no necesariamente
 * el del env default). Convención de env vars:
 *
 *   - `private-mac`   → PRIVATE_LLM_{API_KEY,BASE_URL} + PRIVATE_EMBEDDING_MODEL,
 *                       con fallback a EMBEDDINGS_* (igual que en el código
 *                       original — preserva retrocompat).
 *   - `openai`        → EMBEDDINGS_API_KEY + EMBEDDINGS_MODEL.
 *   - `openai-compat` → EMBEDDINGS_API_KEY + EMBEDDINGS_MODEL + EMBEDDINGS_BASE_URL.
 *   - `fake`          → no necesita nada.
 *
 * Si las env vars del provider pedido no están configuradas, lanza error
 * claro. El caller (controller / service) puede interpretarlo y devolver
 * 400/500 con mensaje específico al frontend.
 */
function readConfigFor(provider: EmbeddingsProvider): EmbeddingsConfig {
  if (provider === 'fake') {
    return {
      provider: 'fake',
      apiKey: 'fake',
      model: process.env.EMBEDDINGS_MODEL ?? 'fake-model',
    };
  }

  // Para private-mac priorizamos PRIVATE_LLM_* / PRIVATE_EMBEDDING_MODEL.
  // Para openai/openai-compat usamos EMBEDDINGS_* directo.
  const apiKey =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_API_KEY ?? process.env.EMBEDDINGS_API_KEY)
      : process.env.EMBEDDINGS_API_KEY;
  if (!apiKey) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_API_KEY/EMBEDDINGS_API_KEY no está definida en el entorno.'
        : 'EMBEDDINGS_API_KEY no está definida en el entorno.',
    );
  }

  const model =
    provider === 'private-mac'
      ? (process.env.PRIVATE_EMBEDDING_MODEL ?? process.env.EMBEDDINGS_MODEL)
      : process.env.EMBEDDINGS_MODEL;
  if (!model) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_EMBEDDING_MODEL/EMBEDDINGS_MODEL no está definida en el entorno.'
        : 'EMBEDDINGS_MODEL no está definida en el entorno.',
    );
  }

  const baseUrl =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_BASE_URL ?? process.env.EMBEDDINGS_BASE_URL)
      : process.env.EMBEDDINGS_BASE_URL;
  if (
    (provider === 'openai-compat' || provider === 'private-mac') &&
    !baseUrl
  ) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_BASE_URL/EMBEDDINGS_BASE_URL es obligatoria cuando el provider es private-mac.'
        : 'EMBEDDINGS_BASE_URL es obligatoria cuando el provider es openai-compat.',
    );
  }

  return { provider, apiKey, model, baseUrl };
}

/** Crea la implementación concreta del EmbeddingsAdapter según el provider. */
export function createEmbeddingsAdapter(
  config: EmbeddingsConfig,
): EmbeddingsAdapter {
  switch (config.provider) {
    case 'openai':
    case 'openai-compat':
      // El mismo adapter sirve para OpenAI nativo y para endpoints
      // OpenAI-compatible (NAI). La diferencia es solo el baseURL del cliente.
      return new OpenAIEmbeddingsAdapter(config);
    case 'private-mac':
      return new PrivateMacEmbeddingsAdapter({
        ...config,
        demoName: process.env.PRIVATE_LLM_DEMO_NAME,
        timeoutMs: Number(process.env.PRIVATE_LLM_TIMEOUT_MS ?? 120000),
      });
    case 'fake':
      return new FakeEmbeddingsAdapter(config);
    default: {
      // Exhaustiveness check — si agregamos un provider al union y olvidamos
      // manejarlo acá, TypeScript marca este caso como error en compilación.
      const _exhaustive: never = config.provider;
      throw new Error(`Provider no manejado: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Metadata observable de un proveedor de embeddings: qué provider es, qué
 * modelo lee del env y qué dimensión produce. Lo usa IngestService para
 * popular `Document.embeddings*` antes de embeber, así puede crear el
 * Document con la metadata correcta dentro de la misma transacción.
 *
 * Lanza si las env vars del provider pedido no están configuradas — la
 * info viene del config validado.
 */
export interface EmbeddingsInfo {
  provider: EmbeddingsProvider;
  model: string;
  dim: number;
}

/**
 * Devuelve la metadata del provider (provider, model, dim) sin instanciar
 * el adapter. La `dim` viene del env (`EMBEDDINGS_DIM`) si está definida
 * y es un número positivo; si no, del default por provider.
 */
export function embeddingsInfoFor(
  provider: EmbeddingsProvider,
): EmbeddingsInfo {
  const config = readConfigFor(provider);
  const envDim = Number(process.env.EMBEDDINGS_DIM);
  const dim =
    Number.isFinite(envDim) && envDim > 0 ? envDim : DEFAULT_DIMS[provider];
  return { provider: config.provider, model: config.model, dim };
}

// ---------------------------------------------------------------------------
// Cache de instancias por provider
//
// Mantenemos `_defaultInstance` para el provider del env (reusa singleton
// clásico) y un Map para los providers pedidos por header. Evita recrear
// adapters por cada request (los SDKs/HTTP clients tienen overhead de init).
//
// El Map vive en memoria del proceso Node. En Railway/Vercel con Fluid
// Compute, las instancias se reusan entre requests del mismo container →
// cache válido. En cold start se reconstruye todo, lo cual es esperable.
// ---------------------------------------------------------------------------

let _defaultInstance: EmbeddingsAdapter | undefined;
const _byProvider = new Map<EmbeddingsProvider, EmbeddingsAdapter>();

/** Devuelve la instancia del provider default (EMBEDDINGS_PROVIDER del env). */
function getDefaultEmbeddings(): EmbeddingsAdapter {
  if (!_defaultInstance) {
    _defaultInstance = createEmbeddingsAdapter(readEmbeddingsConfig());
  }
  return _defaultInstance;
}

/**
 * Devuelve el EmbeddingsAdapter para un provider específico. Si el provider
 * coincide con el del env default, reusa el singleton (no instancia dos
 * veces). Si no, busca en el cache `_byProvider`; si no está, instancia y
 * cachea.
 *
 * Lanza si las env vars del provider pedido no están configuradas — el
 * caller decide qué hacer (típicamente 400 al frontend).
 */
export function embeddingsFor(provider: EmbeddingsProvider): EmbeddingsAdapter {
  // Si el provider pedido es el default del env, reusa el singleton legacy.
  const envProvider = process.env.EMBEDDINGS_PROVIDER as
    | EmbeddingsProvider
    | undefined;
  if (envProvider === provider) {
    return getDefaultEmbeddings();
  }
  const cached = _byProvider.get(provider);
  if (cached) return cached;
  const adapter = createEmbeddingsAdapter(readConfigFor(provider));
  _byProvider.set(provider, adapter);
  return adapter;
}

/** Opciones de cada método del wrapper `embeddings`. */
export interface EmbeddingsCallOptions {
  /**
   * Override del provider para esta llamada. Si se omite, usa el singleton
   * default (`EMBEDDINGS_PROVIDER` del env). El caller típicamente pasa el
   * valor que vino del header `X-LLM-Provider`, mapeado de chat a embeddings
   * vía `resolveEmbeddingsProvider`.
   */
  provider?: EmbeddingsProvider;
}

function resolve(opts?: EmbeddingsCallOptions): EmbeddingsAdapter {
  if (opts?.provider) return embeddingsFor(opts.provider);
  return getDefaultEmbeddings();
}

/**
 * Wrapper del EmbeddingsAdapter — la "puerta" de los embeddings para toda
 * la app. Acepta un segundo argumento opcional `{ provider }` para override
 * en runtime.
 *
 * @example
 *   // Path legacy (singleton del env):
 *   import { embeddings } from '@org/llm-adapter';
 *   const vector = await embeddings.embed('una pregunta');
 *   const vectors = await embeddings.embedMany(['chunk a', 'chunk b']);
 *
 *   // Path override (provider del header HTTP):
 *   const vector = await embeddings.embed('una pregunta', { provider: 'private-mac' });
 */
export const embeddings = {
  embed(text: string, opts?: EmbeddingsCallOptions): Promise<number[]> {
    return resolve(opts).embed(text);
  },
  embedMany(
    texts: string[],
    opts?: EmbeddingsCallOptions,
  ): Promise<number[][]> {
    return resolve(opts).embedMany(texts);
  },
};
