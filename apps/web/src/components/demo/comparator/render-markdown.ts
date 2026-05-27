// -----------------------------------------------------------------------------
// renderMarkdown — parser markdown-light para el output del LLM del comparador.
//
// El kit usa dangerouslySetInnerHTML para esto. Acá tokenizamos a un AST
// chico y la componente emite React nodes — XSS-safe.
//
// Soporta:
//   - `## Heading` → 'h2'
//   - `### Heading` → 'h3'
//   - `- item` → 'list-item' con bullet mint
//   - `**bold**` inline
//   - `[[citation]]` inline (mismo formato que Demo 01)
//   - líneas en blanco → 'blank' (separadores visuales)
//   - todo lo demás → 'paragraph'
//
// El parsing es line-based (los headings ocupan línea completa, igual que
// el markdown estándar). El inline-parsing se aplica al contenido de
// headings/list-items/paragraphs.
// -----------------------------------------------------------------------------

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'citation'; text: string };

export type LineToken =
  | { kind: 'h2'; inline: InlineToken[] }
  | { kind: 'h3'; inline: InlineToken[] }
  | { kind: 'list-item'; inline: InlineToken[] }
  | { kind: 'paragraph'; inline: InlineToken[] }
  | { kind: 'blank' };

/**
 * Tokeniza el output del LLM línea por línea. Devuelve un array de
 * LineToken que la componente pinta como secuencia de elementos.
 *
 * Garantía mínima: el resultado es estable (mismo input → mismo output),
 * sin estado compartido entre llamadas.
 */
export function renderMarkdown(input: string): LineToken[] {
  const lines = input.split('\n');
  return lines.map((line): LineToken => {
    const trimmed = line.trimEnd();
    if (trimmed === '') return { kind: 'blank' };

    if (trimmed.startsWith('### ')) {
      return { kind: 'h3', inline: parseInline(trimmed.slice(4)) };
    }
    if (trimmed.startsWith('## ')) {
      return { kind: 'h2', inline: parseInline(trimmed.slice(3)) };
    }
    if (trimmed.startsWith('- ')) {
      return { kind: 'list-item', inline: parseInline(trimmed.slice(2)) };
    }
    return { kind: 'paragraph', inline: parseInline(trimmed) };
  });
}

/**
 * Parsea inline tokens dentro de una línea de texto. Maneja **bold** y
 * [[citation]] con un solo paso, respetando orden de aparición.
 *
 * Implementación: regex que matchea cualquiera de los dos patrones; las
 * partes entre matches son text. Sin nesting (no bold-dentro-de-cita
 * ni viceversa — el LLM no las mezcla en la práctica).
 */
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*([^*]+)\*\*|\[\[([^\]]+)\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: 'text', text: text.slice(cursor, match.index) });
    }
    if (match[1] !== undefined) {
      // grupo 1 capturó (entre **): bold
      tokens.push({ kind: 'bold', text: match[1] });
    } else if (match[2] !== undefined) {
      // grupo 2 capturó (entre [[]] ): citation
      tokens.push({ kind: 'citation', text: match[2] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    tokens.push({ kind: 'text', text: text.slice(cursor) });
  }
  return tokens;
}
