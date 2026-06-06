// -----------------------------------------------------------------------------
// ChatAdapter singleton + factory por provider (switch dinámico via header).
//
// Hay DOS caminos de uso, coexistiendo:
//
//   1. Singleton legacy `chat.completeStream(messages)`:
//      Lee `CHAT_PROVIDER` del env al primer uso, instancia el adapter
//      correspondiente y lo cachea. Compatibilidad hacia atrás: TODAS las
//      llamadas viejas siguen funcionando idénticas.
//
//   2. Override por provider `chat.completeStream(messages, { provider })`:
//      Cuando el caller especifica `provider`, usamos el adapter de ese
//      provider (instanciado y cacheado en un Map). Esto permite que el
//      frontend mande un header `X-LLM-Provider` y el backend respete la
//      elección del usuario en runtime (ver `@CurrentLlmProvider()`
//      decorator en apps/api).
//
// Lazy: importar este módulo NO falla si faltan env vars. Falla recién cuando
// se llama a un método del singleton. Esto permite que los tests importen
// tipos del package sin tener el entorno configurado.
// -----------------------------------------------------------------------------

import { AnthropicChatAdapter } from './providers/anthropic-chat.js';
import { FakeChatAdapter } from './providers/fake-chat.js';
import { OpenAICompatChatAdapter } from './providers/openai-compat-chat.js';
import { PrivateMacChatAdapter } from './providers/private-mac-chat.js';
import type {
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatProvider,
  ChatRichMessage,
  ChatTool,
} from './types.js';

/** Set de providers válidos — espejo del union `ChatProvider`. */
const VALID_PROVIDERS: ReadonlySet<ChatProvider> = new Set([
  'anthropic',
  'openai-compat',
  'private-mac',
  'fake',
]);

/**
 * Type guard para validar un string suelto (ej. valor de un header HTTP)
 * contra el union `ChatProvider`. Devuelve `false` si el string no matchea
 * ningún provider conocido.
 */
export function isValidChatProvider(s: string): s is ChatProvider {
  return VALID_PROVIDERS.has(s as ChatProvider);
}

/**
 * Lee las env vars de chat y arma un ChatConfig validado.
 * Lanza si falta algo obligatorio o si los valores son inválidos.
 *
 * Caso especial `CHAT_PROVIDER=fake`: el adapter es totalmente
 * determinístico y no llama a ningún LLM real, así que API key / modelo /
 * baseUrl son **opcionales**. Esto permite arrancar la app en CI o tests
 * E2E sin necesidad de configurar secretos.
 */
export function readChatConfig(): ChatConfig {
  const provider = process.env.CHAT_PROVIDER;
  if (!provider) {
    throw new Error('CHAT_PROVIDER no está definida en el entorno.');
  }
  if (!isValidChatProvider(provider)) {
    throw new Error(
      `CHAT_PROVIDER inválido: "${provider}". Esperado: 'anthropic', 'openai-compat', 'private-mac' o 'fake'.`,
    );
  }
  return readConfigFor(provider);
}

/**
 * Arma un ChatConfig para un provider arbitrario (no necesariamente el del
 * env default). Convención de env vars:
 *
 *   - `anthropic`     → CHAT_API_KEY + CHAT_MODEL (asume que el env default
 *                       ya tiene credenciales Anthropic; el caso típico).
 *   - `private-mac`   → PRIVATE_LLM_{API_KEY,MODEL,BASE_URL} con fallback
 *                       a CHAT_* (igual que el código original).
 *   - `openai-compat` → CHAT_API_KEY + CHAT_MODEL + CHAT_BASE_URL.
 *   - `fake`          → no necesita nada.
 *
 * Si las env vars del provider pedido no están configuradas, lanza error
 * claro. El caller (controller) puede interpretarlo y devolver 400/500 con
 * mensaje específico al frontend.
 */
function readConfigFor(provider: ChatProvider): ChatConfig {
  if (provider === 'fake') {
    return {
      provider: 'fake',
      apiKey: 'fake',
      model: process.env.CHAT_MODEL ?? 'fake-model',
    };
  }

  // Para private-mac priorizamos PRIVATE_LLM_* con fallback a CHAT_*.
  // Para anthropic/openai-compat usamos CHAT_* directo.
  const apiKey =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_API_KEY ?? process.env.CHAT_API_KEY)
      : process.env.CHAT_API_KEY;
  if (!apiKey) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_API_KEY/CHAT_API_KEY no está definida en el entorno.'
        : 'CHAT_API_KEY no está definida en el entorno.',
    );
  }

  const model =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_MODEL ?? process.env.CHAT_MODEL)
      : process.env.CHAT_MODEL;
  if (!model) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_MODEL/CHAT_MODEL no está definida en el entorno.'
        : 'CHAT_MODEL no está definida en el entorno.',
    );
  }

  const baseUrl =
    provider === 'private-mac'
      ? (process.env.PRIVATE_LLM_BASE_URL ?? process.env.CHAT_BASE_URL)
      : process.env.CHAT_BASE_URL;
  if (
    (provider === 'openai-compat' || provider === 'private-mac') &&
    !baseUrl
  ) {
    throw new Error(
      provider === 'private-mac'
        ? 'PRIVATE_LLM_BASE_URL/CHAT_BASE_URL es obligatoria cuando el provider es private-mac.'
        : 'CHAT_BASE_URL es obligatoria cuando el provider es openai-compat.',
    );
  }

  return { provider, apiKey, model, baseUrl };
}

/** Crea la implementación concreta del ChatAdapter según el provider. */
export function createChatAdapter(config: ChatConfig): ChatAdapter {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicChatAdapter(config);
    case 'openai-compat':
      return new OpenAICompatChatAdapter(config);
    case 'private-mac':
      return new PrivateMacChatAdapter({
        ...config,
        demoName: process.env.PRIVATE_LLM_DEMO_NAME,
        timeoutMs: Number(process.env.PRIVATE_LLM_TIMEOUT_MS ?? 120000),
      });
    case 'fake':
      return new FakeChatAdapter(config);
    default: {
      // Exhaustiveness check — si agregamos un provider al union y olvidamos
      // manejarlo acá, TypeScript marca este caso como error en compilación.
      const _exhaustive: never = config.provider;
      throw new Error(`Provider no manejado: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Cache de instancias por provider
//
// Mantenemos un Map<ChatProvider, ChatAdapter>. Para el path default (sin
// override), reusamos el singleton clásico vía `_defaultInstance`. Para los
// providers pedidos por header, los almacenamos por separado. Esto evita
// recrear adapters por cada request (los SDKs/HTTP clients tienen overhead
// de inicialización).
//
// El Map vive en memoria del proceso Node. En Railway/Vercel Functions con
// Fluid Compute, las instancias se reusan entre requests del mismo container
// → cache válido. En un cold start, se reconstruye todo, lo cual es esperable.
// ---------------------------------------------------------------------------

let _defaultInstance: ChatAdapter | undefined;
const _byProvider = new Map<ChatProvider, ChatAdapter>();

/** Devuelve la instancia del provider default (CHAT_PROVIDER del env). */
function getDefaultChat(): ChatAdapter {
  if (!_defaultInstance) {
    _defaultInstance = createChatAdapter(readChatConfig());
  }
  return _defaultInstance;
}

/**
 * Devuelve el ChatAdapter para un provider específico. Si el provider
 * coincide con el del env default, reusa el singleton (no instancia dos
 * veces). Si no, busca en el cache `_byProvider`; si no está, instancia y
 * cachea.
 *
 * Lanza si las env vars del provider pedido no están configuradas — el
 * caller decide qué hacer (típicamente 400 al frontend).
 */
export function chatFor(provider: ChatProvider): ChatAdapter {
  // Si el provider pedido es el default del env, reusa el singleton legacy.
  const envProvider = process.env.CHAT_PROVIDER as ChatProvider | undefined;
  if (envProvider === provider) {
    return getDefaultChat();
  }
  const cached = _byProvider.get(provider);
  if (cached) return cached;
  const adapter = createChatAdapter(readConfigFor(provider));
  _byProvider.set(provider, adapter);
  return adapter;
}

/** Opciones de cada método del wrapper `chat`. */
export interface ChatCallOptions {
  /**
   * Override del provider para esta llamada. Si se omite, usa el singleton
   * default (`CHAT_PROVIDER` del env). El caller típicamente pasa el valor
   * que vino del header `X-LLM-Provider`, validado con `isValidChatProvider`.
   */
  provider?: ChatProvider;
}

function resolve(opts?: ChatCallOptions): ChatAdapter {
  if (opts?.provider) return chatFor(opts.provider);
  return getDefaultChat();
}

/**
 * Wrapper del ChatAdapter — la "puerta" del chat para toda la app. Acepta
 * un segundo argumento opcional `{ provider }` para override en runtime.
 *
 * @example
 *   // Path legacy (singleton del env):
 *   import { chat } from '@org/llm-adapter';
 *   for await (const token of chat.completeStream(messages)) {
 *     process.stdout.write(token);
 *   }
 *
 *   // Path override (provider del header HTTP):
 *   for await (const token of chat.completeStream(messages, { provider: 'private-mac' })) {
 *     process.stdout.write(token);
 *   }
 */
export const chat = {
  completeStream(messages: ChatMessage[], opts?: ChatCallOptions) {
    return resolve(opts).completeStream(messages);
  },
  completeStreamWithUsage(messages: ChatMessage[], opts?: ChatCallOptions) {
    return resolve(opts).completeStreamWithUsage(messages);
  },
  streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
    opts?: ChatCallOptions,
  ) {
    return resolve(opts).streamWithTools(messages, tools);
  },
};
