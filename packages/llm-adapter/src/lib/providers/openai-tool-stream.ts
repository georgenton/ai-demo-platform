// -----------------------------------------------------------------------------
// Parser de stream OpenAI-compatible con tool use.
//
// La spec OpenAI streaming con tools (también soportada por Ollama 0.5+, vLLM
// y NAI/NIM) manda los eventos así:
//
//   data: {"choices":[{"delta":{"content":"texto"},"index":0}]}              ← text delta
//   data: {"choices":[{"delta":{"tool_calls":[{
//     "index":0,"id":"call_1","type":"function",
//     "function":{"name":"run_sql","arguments":"{\\"sql\\":"}
//   }]},"index":0}]}                                                          ← inicio tool
//   data: {"choices":[{"delta":{"tool_calls":[{
//     "index":0,"function":{"arguments":"\\"SELECT 1\\""}
//   }]},"index":0}]}                                                          ← más args
//   data: {"choices":[{"delta":{"tool_calls":[{
//     "index":0,"function":{"arguments":"}"}
//   }]},"index":0}]}                                                          ← cierre args
//   data: {"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}]}   ← fin del turn
//   data: [DONE]                                                              ← stream completo
//
// El parser mantiene un buffer por `tool_calls[*].index` porque los argumentos
// se envían progresivamente como strings JSON parciales. Al detectar
// `finish_reason: tool_calls`, emite `tool_use_complete` para cada tool y un
// `turn_end` con stopReason='tool_use'. Para `finish_reason: stop` emite
// `turn_end` con stopReason='end_turn'.
//
// Usado por `PrivateMacChatAdapter`, `PrivateOnpremChatAdapter` y
// `OpenAICompatChatAdapter` (los 3 hablan OpenAI-compat).
// -----------------------------------------------------------------------------

import type {
  AssistantStreamEvent,
  ChatRichMessage,
  ChatTool,
  StopReason,
  ToolUseBlock,
} from '../types.js';

/**
 * Convierte un `ChatRichMessage` (formato Anthropic-style con bloques) al
 * formato OpenAI-compatible (mensajes flat con `role: tool` para resultados).
 *
 * Las diferencias críticas:
 *   - Anthropic permite `user` con content=ToolResultBlock[]. OpenAI usa
 *     `role: 'tool'` con `tool_call_id` separado por mensaje.
 *   - Anthropic permite `assistant` con content=(TextBlock|ToolUseBlock)[].
 *     OpenAI lo divide en un `assistant` con `content` (texto) más
 *     `tool_calls[]`.
 */
export function messagesToOpenAI(
  messages: ChatRichMessage[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      out.push({ role: 'system', content: msg.content });
      continue;
    }
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'user', content: msg.content });
        continue;
      }
      // ToolResultBlock[] → un mensaje `role: tool` por cada resultado.
      for (const block of msg.content) {
        out.push({
          role: 'tool',
          tool_call_id: block.toolUseId,
          content: block.isError ? `[ERROR] ${block.content}` : block.content,
        });
      }
      continue;
    }
    // assistant
    if (typeof msg.content === 'string') {
      out.push({ role: 'assistant', content: msg.content });
      continue;
    }
    // (TextBlock | ToolUseBlock)[]
    const textParts: string[] = [];
    const toolCalls: Array<Record<string, unknown>> = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }
    const assistantMsg: Record<string, unknown> = { role: 'assistant' };
    // OpenAI exige que content esté presente (null o string). Si solo había
    // tools sin texto, mandamos null.
    assistantMsg.content = textParts.length ? textParts.join('') : null;
    if (toolCalls.length) assistantMsg.tool_calls = toolCalls;
    out.push(assistantMsg);
  }
  return out;
}

/**
 * Convierte el array `ChatTool[]` al shape OpenAI tools.
 */
export function toolsToOpenAI(
  tools: ChatTool[],
): Array<Record<string, unknown>> {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * Mapea el `finish_reason` de OpenAI al `StopReason` del adapter.
 */
function mapFinishReason(raw: string | null | undefined): StopReason {
  switch (raw) {
    case 'tool_calls':
      return 'tool_use';
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    default:
      return 'other';
  }
}

/**
 * Tool call en construcción mientras llegan los chunks. `args` se acumula
 * como string JSON parcial; al cierre lo parseamos.
 */
interface PartialTool {
  id: string;
  name: string;
  args: string;
}

/**
 * Parsea un stream SSE OpenAI-compatible y emite `AssistantStreamEvent`s.
 *
 * El caller pasa una `Response` con `body` accesible. La función se
 * encarga de:
 *   - Leer chunk por chunk del ReadableStream.
 *   - Bufferear lineas SSE incompletas hasta tener `data: ...\n\n`.
 *   - Saltarse `data: [DONE]` (cierre).
 *   - Acumular `tool_calls[*].function.arguments` por índice.
 *   - Emitir `text_delta` por cada delta de texto.
 *   - Al detectar `finish_reason`, emitir `tool_use_complete` por cada tool
 *     completo y luego `turn_end` con el stopReason mapeado.
 *
 * Errores que escapan:
 *   - `args` JSON malformado al final de un tool call → captura y emite el
 *     tool con `input: {}` para no romper el flow (el LLM puede recuperarse
 *     en el próximo turn con el error del tool result).
 *   - SSE truncado a mitad → el `for await` corta naturalmente.
 */
export async function* parseOpenAIToolStream(
  response: Response,
): AsyncIterable<AssistantStreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  // tool_calls[index] → PartialTool en construcción.
  const partials = new Map<number, PartialTool>();
  // Stop reason del último chunk con finish_reason — se emite en turn_end.
  let stopReason: StopReason = 'other';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Procesamos eventos completos (separados por \n\n).
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      // Cada evento puede tener varias líneas; solo nos interesa `data: ...`.
      const dataLine = event
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      const payload = dataLine.slice(6).trim();
      if (payload === '[DONE]') continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(payload);
      } catch {
        // SSE corrupto — saltarse y seguir.
        continue;
      }

      const choices = parsed.choices as
        | Array<Record<string, unknown>>
        | undefined;
      const choice = choices?.[0];
      if (!choice) continue;

      const delta = choice.delta as Record<string, unknown> | undefined;
      const finishReason = choice.finish_reason as string | null | undefined;

      // 1) Text delta.
      if (delta?.content && typeof delta.content === 'string') {
        yield { type: 'text_delta', text: delta.content };
      }

      // 2) Tool call deltas — acumular por índice.
      const toolCalls = delta?.tool_calls as
        | Array<Record<string, unknown>>
        | undefined;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const index = (tc.index as number) ?? 0;
          const existing = partials.get(index) ?? {
            id: '',
            name: '',
            args: '',
          };
          if (typeof tc.id === 'string' && tc.id) existing.id = tc.id;
          const func = tc.function as
            | { name?: string; arguments?: string }
            | undefined;
          if (func?.name) existing.name = func.name;
          if (typeof func?.arguments === 'string')
            existing.args += func.arguments;
          partials.set(index, existing);
        }
      }

      // 3) finish_reason llegó → emitir tools completos + turn_end.
      if (finishReason) {
        stopReason = mapFinishReason(finishReason);
        if (stopReason === 'tool_use') {
          // Emitimos un evento por cada tool acumulado, en orden de índice.
          const indices = Array.from(partials.keys()).sort((a, b) => a - b);
          for (const idx of indices) {
            const p = partials.get(idx);
            if (!p) continue;
            let input: unknown = {};
            try {
              input = p.args ? JSON.parse(p.args) : {};
            } catch {
              // Args malformados — emitimos input vacío. El LLM podría
              // recuperarse, o el caller decidirá qué hacer con el error.
              input = {};
            }
            const event: AssistantStreamEvent = {
              type: 'tool_use_complete',
              id: p.id || `tool_${idx}`,
              name: p.name,
              input,
            };
            yield event;
          }
        }
        yield { type: 'turn_end', stopReason };
        return;
      }
    }
  }

  // El stream cerró sin finish_reason explícito (raro). Emitimos turn_end
  // con `other` para que el caller no quede colgado.
  yield { type: 'turn_end', stopReason };
}

// Re-export del tipo para tests.
export type { ToolUseBlock };
