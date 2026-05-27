// -----------------------------------------------------------------------------
// renderCitations — convierte el texto de respuesta del LLM en un array
// de tokens que la burbuja del chat pinta:
//   - 'text'     → texto plano
//   - 'citation' → fragmento `[[...]]` que va con la clase `.citation-inline`
//   - 'break'    → newline (cada \n se pinta como <br />)
//
// El kit usa el formato `[[Reglamento, art. 14]]` para marcar citas. Si el
// LLM real no emite ese formato, el texto se renderiza tal cual y nada se
// rompe — la función es defensiva. Cuando ajustemos el system prompt del
// backend para forzar `[[...]]`, la UI ya está lista.
//
// Implementación: usamos String.prototype.split con regex `g` para
// preservar los matches en el resultado y procesarlos en orden, sin
// dangerouslySetInnerHTML (XSS-safe).
// -----------------------------------------------------------------------------

export type CitationToken =
  | { kind: 'text'; text: string }
  | { kind: 'citation'; text: string }
  | { kind: 'break' };

const CITATION_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Tokeniza un mensaje del LLM para que la UI lo pinte en spans tipados.
 *
 * Garantía: la concatenación de los `text`s (ignorando `break`) más los
 * `\n` reconstruye el input original. (verificado por test).
 */
export function renderCitations(input: string): CitationToken[] {
  const tokens: CitationToken[] = [];

  // Separamos primero por línea — los \n se materializan como tokens
  // `break` para que el componente pueda mapear a <br />.
  const lines = input.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tokens.push({ kind: 'break' });
    const line = lines[i];
    if (!line) continue;

    // Dentro de la línea, encontrar las citas. Reset del lastIndex para
    // que no acumule estado entre llamadas (regex es global).
    CITATION_RE.lastIndex = 0;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = CITATION_RE.exec(line)) !== null) {
      if (match.index > cursor) {
        tokens.push({ kind: 'text', text: line.slice(cursor, match.index) });
      }
      tokens.push({ kind: 'citation', text: match[1] });
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length) {
      tokens.push({ kind: 'text', text: line.slice(cursor) });
    }
  }

  return tokens;
}
