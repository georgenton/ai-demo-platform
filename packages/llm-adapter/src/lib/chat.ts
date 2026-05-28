// -----------------------------------------------------------------------------
// Singleton del ChatAdapter, configurado desde env vars al primer uso.
//
// Lazy: importar este módulo NO falla si faltan env vars. Falla recién cuando
// se llama a un método del singleton. Esto permite que los tests importen
// tipos del package sin tener el entorno configurado.
// -----------------------------------------------------------------------------

import { AnthropicChatAdapter } from './providers/anthropic-chat.js';
import { FakeChatAdapter } from './providers/fake-chat.js';
import { OpenAICompatChatAdapter } from './providers/openai-compat-chat.js';
import type { ChatAdapter, ChatConfig } from './types.js';

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
  if (
    provider !== 'anthropic' &&
    provider !== 'openai-compat' &&
    provider !== 'fake'
  ) {
    throw new Error(
      `CHAT_PROVIDER inválido: "${provider}". Esperado: 'anthropic', 'openai-compat' o 'fake'.`,
    );
  }

  // Provider 'fake': no exigimos credenciales. Mandamos placeholders para
  // satisfacer el shape de ChatConfig — el FakeChatAdapter los ignora.
  if (provider === 'fake') {
    return {
      provider: 'fake',
      apiKey: 'fake',
      model: process.env.CHAT_MODEL ?? 'fake-model',
    };
  }

  const apiKey = process.env.CHAT_API_KEY;
  if (!apiKey) {
    throw new Error('CHAT_API_KEY no está definida en el entorno.');
  }

  const model = process.env.CHAT_MODEL;
  if (!model) {
    throw new Error('CHAT_MODEL no está definida en el entorno.');
  }

  const baseUrl = process.env.CHAT_BASE_URL;
  if (provider === 'openai-compat' && !baseUrl) {
    throw new Error(
      'CHAT_BASE_URL es obligatoria cuando CHAT_PROVIDER=openai-compat.',
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

let _instance: ChatAdapter | undefined;

function getChat(): ChatAdapter {
  if (!_instance) {
    _instance = createChatAdapter(readChatConfig());
  }
  return _instance;
}

/**
 * Singleton del ChatAdapter — la "puerta" del chat para toda la app.
 *
 * @example
 *   import { chat } from '@org/llm-adapter';
 *   for await (const token of chat.completeStream(messages)) {
 *     process.stdout.write(token);
 *   }
 */
export const chat: ChatAdapter = {
  completeStream(messages) {
    return getChat().completeStream(messages);
  },
  completeStreamWithUsage(messages) {
    return getChat().completeStreamWithUsage(messages);
  },
  streamWithTools(messages, tools) {
    return getChat().streamWithTools(messages, tools);
  },
};
