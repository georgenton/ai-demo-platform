// -----------------------------------------------------------------------------
// Tipos y interfaces del LLMAdapter.
//
// Dos concerns, dos interfaces (ver ADR-0009):
//   - ChatAdapter:       el LLM responde preguntas con streaming de tokens.
//   - EmbeddingsAdapter: el LLM convierte texto en vectores numéricos.
//
// Cada interface se implementa por su propio provider (Anthropic, OpenAI,
// NAI, etc.) y se elige al arrancar la app vía env vars.
// -----------------------------------------------------------------------------

/**
 * Un mensaje en una conversación con el LLM. Roles posibles:
 *   - 'system':    instrucciones generales para el modelo.
 *   - 'user':      lo que pide la persona.
 *   - 'assistant': respuestas previas del modelo (mantener contexto).
 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Adapter para chat / completions con streaming.
 *
 * `completeStream` devuelve un `AsyncIterable<string>`: cada elemento es un
 * "delta" de texto que el LLM va emitiendo. El consumidor itera con
 * `for await ... of` y reenvía cada token al cliente (típicamente vía SSE).
 */
export interface ChatAdapter {
  completeStream(messages: ChatMessage[]): AsyncIterable<string>;
}

/**
 * Adapter para embeddings.
 *
 * `embed` convierte un texto en un vector numérico. `embedMany` hace lo mismo
 * para un batch — más eficiente en una sola llamada al proveedor.
 *
 * La dimensión del vector la fija el modelo subyacente (1536 con OpenAI
 * text-embedding-3-small — ver ADR-0008) y debe coincidir con la columna
 * `vector(N)` en pgvector.
 */
export interface EmbeddingsAdapter {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}

// -----------------------------------------------------------------------------
// Configuración (se construye desde env vars en chat.ts / embeddings.ts)
// -----------------------------------------------------------------------------

/** Proveedores soportados para chat. */
export type ChatProvider = 'anthropic' | 'openai-compat';

/** Proveedores soportados para embeddings. */
export type EmbeddingsProvider = 'openai' | 'openai-compat';

/**
 * Configuración del ChatAdapter. Se construye desde:
 *   CHAT_PROVIDER, CHAT_API_KEY, CHAT_MODEL, CHAT_BASE_URL (opcional).
 * `baseUrl` solo se usa con `provider='openai-compat'` (ej: NAI on-prem).
 */
export type ChatConfig = {
  provider: ChatProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

/**
 * Configuración del EmbeddingsAdapter. Se construye desde:
 *   EMBEDDINGS_PROVIDER, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_BASE_URL.
 * `baseUrl` solo se usa con `provider='openai-compat'` (ej: NAI on-prem).
 */
export type EmbeddingsConfig = {
  provider: EmbeddingsProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
};
