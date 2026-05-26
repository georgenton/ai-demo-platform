// -----------------------------------------------------------------------------
// ComparePromptBuilder — arma el prompt del comparador (Demo 02).
//
// A diferencia del PromptBuilder de @org/rag-core (que toma pregunta + chunks
// recuperados por similitud), este toma:
//   - una lista de documentos a comparar (contenido completo o truncado),
//   - una lista de dimensiones (ejes de comparación que pide el usuario).
//
// Vive co-localizado con el CompareModule en vez de en rag-core porque es
// 100% específico de Demo 02: nadie más lo usa. Si Demo 04 u otros llegan a
// necesitar prompts comparativos, lo movemos a un package compartido.
// -----------------------------------------------------------------------------

import type { ChatMessage } from '@org/llm-adapter';

export interface CompareDocument {
  /** ID del documento — el LLM lo cita en su respuesta para trazabilidad. */
  id: string;
  /** Nombre legible (lo mostramos también en la respuesta). */
  name: string;
  /** Contenido completo o truncado del documento. */
  content: string;
  /**
   * `true` cuando `content` fue recortado por `truncateToFit()`. El prompt
   * lo informa al LLM para que avise si la respuesta podría depender de la
   * parte cortada.
   */
  truncated: boolean;
}

export interface ComparePromptInput {
  documents: CompareDocument[];
  dimensions: string[];
  /** Override opcional del system prompt — útil para tests o variantes. */
  systemPrompt?: string;
}

/**
 * System prompt del comparador. Las reglas son distintas a las del RAG porque
 * el modo de uso también lo es: acá el usuario ya eligió los documentos, no
 * preguntó "qué dice X" sino "compará A y B en estos ejes". Las reglas
 * apuntan a una salida estructurada y citada.
 */
export const DEFAULT_COMPARE_SYSTEM_PROMPT = `Sos un analista experto en comparar documentos institucionales (contratos, reglamentos, manuales).

Tarea: para cada dimensión que el usuario pide, contrastá los documentos lado a lado.

Reglas estrictas:
1. Estructurá la respuesta en secciones, UNA por dimensión.
2. Dentro de cada sección, mencioná qué dice CADA documento sobre esa dimensión, citando la frase exacta entre comillas.
3. Si un documento no menciona la dimensión, decí explícitamente "el documento <id> no aborda esta dimensión".
4. Cerrá cada dimensión con una observación corta sobre la diferencia clave (no rellenes si los documentos son equivalentes — decilo y seguí).
5. Respondé en el idioma de las dimensiones del usuario.
6. Si algún documento llega truncado, avisá al final que la comparación se basa en la parte disponible y que la conclusión podría cambiar con el texto completo.`;

export class ComparePromptBuilder {
  build(input: ComparePromptInput): ChatMessage[] {
    const systemPrompt = input.systemPrompt ?? DEFAULT_COMPARE_SYSTEM_PROMPT;
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: this.formatUserMessage(input) },
    ];
  }

  private formatUserMessage(input: ComparePromptInput): string {
    const docsBlock = input.documents
      .map((doc) => this.formatDocument(doc))
      .join('\n\n');

    const dimensionsBlock = input.dimensions
      .map((dim, i) => `${i + 1}. ${dim}`)
      .join('\n');

    return `Documentos a comparar:

${docsBlock}

---

Dimensiones a comparar:
${dimensionsBlock}`;
  }

  private formatDocument(doc: CompareDocument): string {
    const header = `--- Documento ${doc.id} ("${doc.name}")${doc.truncated ? ' [TRUNCADO]' : ''} ---`;
    return `${header}\n${doc.content}`;
  }
}
