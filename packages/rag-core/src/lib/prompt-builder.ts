// -----------------------------------------------------------------------------
// PromptBuilder — arma el prompt final que se le manda al LLM.
//
// Toma:
//   - la pregunta del usuario,
//   - los chunks recuperados del retrieval (los más relevantes),
//   - opcionalmente, un system prompt custom (útil para demos específicos).
//
// Devuelve un ChatMessage[] listo para `chat.completeStream()` del LLMAdapter.
// -----------------------------------------------------------------------------

import type { ChatMessage } from '@org/llm-adapter';

export interface RetrievedChunk {
  content: string;
  documentId: string;
  index: number;
}

export interface PromptInput {
  question: string;
  chunks: RetrievedChunk[];
  /** Si se provee, reemplaza al system prompt por defecto. */
  systemPrompt?: string;
}

/**
 * System prompt por defecto: instruye al LLM a:
 *   1. Usar solo la información de los fragmentos provistos.
 *   2. Decir explícitamente "no encuentro" cuando la respuesta no está.
 *   3. Citar el fragmento exacto entre comillas.
 *   4. Responder en el idioma de la pregunta del usuario.
 *
 * Es la línea que separa un RAG útil de un LLM que alucina con confianza.
 */
export const DEFAULT_SYSTEM_PROMPT = `Sos un asistente que responde preguntas sobre documentos institucionales.

Reglas estrictas:
1. Respondé ÚNICAMENTE con información de los fragmentos provistos abajo.
2. Si la respuesta no está en los fragmentos, decí literalmente: "No encuentro esa información en el documento."
3. Cuando uses información de un fragmento, citá la frase exacta entre comillas.
4. Respondé en el mismo idioma de la pregunta del usuario.`;

export class PromptBuilder {
  build(input: PromptInput): ChatMessage[] {
    const systemPrompt = input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const userContent =
      input.chunks.length > 0
        ? this.formatWithContext(input.question, input.chunks)
        : input.question;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];
  }

  private formatWithContext(
    question: string,
    chunks: RetrievedChunk[],
  ): string {
    const contextBlock = chunks
      .map(
        (chunk, i) =>
          `--- Fragmento ${i + 1} (documento ${chunk.documentId}, posición ${chunk.index}) ---\n${chunk.content}`,
      )
      .join('\n\n');

    return `Fragmentos relevantes del documento:\n\n${contextBlock}\n\n---\n\nPregunta del usuario:\n${question}`;
  }
}
