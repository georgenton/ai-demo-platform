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
 * Dos métodos:
 *   - `completeStream`: streaming simple de texto. Útil para chat (Demo 01)
 *     y compare (Demo 02). No soporta tool use — devuelve solo tokens.
 *   - `streamWithTools`: streaming con tool use (function calling). Necesario
 *     para Demo 04 (agente). El stream emite eventos tipados (texto, pedidos
 *     de tool, fin de turno con stop_reason). Cuando el LLM pide tools, el
 *     consumidor los ejecuta, agrega los resultados al array de mensajes y
 *     llama de nuevo (loop multi-vuelta).
 */
export interface ChatAdapter {
  completeStream(messages: ChatMessage[]): AsyncIterable<string>;
  streamWithTools(
    messages: ChatRichMessage[],
    tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent>;
}

// ---------------------------------------------------------------------------
// Tipos para tool use (Demo 04)
// ---------------------------------------------------------------------------

/**
 * Definición de un tool que el LLM puede invocar. `inputSchema` es un JSON
 * Schema mínimo: tipo objeto con propiedades. El SDK de Anthropic acepta
 * cualquier JSON Schema válido — replicamos eso sin sobre-tipar acá.
 */
export interface ChatTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Bloque de texto dentro del contenido de un mensaje. */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Bloque que representa un pedido del LLM para invocar un tool. */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  /** Input ya parseado a objeto (no string JSON). El adapter hace el parseo. */
  input: unknown;
}

/** Bloque con el resultado de ejecutar un tool, que se manda al LLM en el siguiente turn. */
export interface ToolResultBlock {
  type: 'tool_result';
  /** Debe coincidir con el `id` de un `ToolUseBlock` previo del assistant. */
  toolUseId: string;
  /** Resultado serializado (típicamente JSON.stringify de los rows, o mensaje de error). */
  content: string;
  /** Marcamos `true` si la ejecución falló — el LLM lo interpreta como error. */
  isError?: boolean;
}

/**
 * Mensaje "rico" que soporta el shape con bloques de Anthropic.
 *
 * Un `user` puede mandar texto plano o un array de tool_results (cuando
 * devuelve la salida de los tools que el LLM pidió antes).
 * Un `assistant` puede mandar texto plano o un array de text + tool_use
 * (replay de un turn previo, para mantener el contexto en el loop).
 */
export type ChatRichMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: string | (TextBlock | ToolUseBlock)[] };

/** Por qué terminó un turno del LLM. */
export type StopReason =
  | 'end_turn' // el LLM decidió que terminó — no quiere más tools
  | 'tool_use' // pidió ejecutar uno o más tools; hay que loopear
  | 'max_tokens' // se quedó sin presupuesto de tokens
  | 'stop_sequence' // pegó una stop sequence (no lo usamos hoy)
  | 'other';

/**
 * Eventos del stream de un turn con tools. El consumidor itera con
 * `for await` y reacciona:
 *   - `text_delta`: emitir token al frontend (SSE).
 *   - `tool_use_complete`: el LLM terminó de pedir un tool; ejecutar.
 *   - `turn_end`: terminó el turn; si stopReason='tool_use', loopear.
 */
export type AssistantStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  | { type: 'turn_end'; stopReason: StopReason };

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
