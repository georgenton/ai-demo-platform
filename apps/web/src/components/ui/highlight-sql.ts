// -----------------------------------------------------------------------------
// Highlighter de SQL casero (sin Prism/Shiki). Vive en un archivo `.ts` puro
// (sin JSX) para que vitest pueda importarlo en sus tests sin chocar contra
// `tsconfig.jsx = preserve` que necesita Next.js.
//
// Cubre 4 categorías de tokens:
//   - kw  → SELECT, FROM, WHERE, GROUP BY, ORDER BY, JOIN, ...
//   - fn  → COUNT, AVG, EXTRACT, COALESCE, ...
//   - str → 'literales entre comillas simples'
//   - num → 1, 42, 2025
// Resto va como .punc (texto base).
//
// Estrategia: usamos caracteres de control Unicode como sentinels invisibles
// para delimitar tokens detectados por regex, después caminamos el string
// una vez y emitimos los `{ kind, text }`. Construimos los sentinels con
// `String.fromCharCode(0..3)` en vez de literales (los control chars en
// source code se pierden cuando algunas herramientas guardan el archivo).
// Ninguna SQL real contiene esos bytes, así que son seguros.
//
// Detalle: la primera pasada extrae los strings literales (que pueden
// contener dígitos como '2025-1') a un array side-car con su texto original,
// y los reemplaza por `<STR><STR>` (cuerpo vacío). Las pasadas siguientes
// (kw/fn/num) trabajan sobre una `s` que ya no tiene strings — así no se
// confunden con los dígitos que vivían adentro. El parser consume los STR
// sentinels en orden y va sacando del array.
// -----------------------------------------------------------------------------

const SQL_KW =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INNER|LEFT|RIGHT|JOIN|ON|AS|AND|OR|NOT|IN|IS|NULL|DESC|ASC|DISTINCT)\b/g;
const SQL_FN =
  /\b(COUNT|AVG|SUM|MIN|MAX|EXTRACT|DATE_TRUNC|LOWER|UPPER|COALESCE)\b/g;

// Caracteres de control Unicode (NUL/SOH/STX/ETX) reservados como sentinels.
// Construidos en runtime para sobrevivir a herramientas que normalizan
// control chars al guardar el archivo.
const SENTINEL_STR = String.fromCharCode(0); // NUL → string literal
const SENTINEL_KW = String.fromCharCode(1); // SOH → keyword
const SENTINEL_FN = String.fromCharCode(2); // STX → function name
const SENTINEL_NUM = String.fromCharCode(3); // ETX → number literal

export type SqlTokenKind = 'kw' | 'fn' | 'str' | 'num' | 'punc';

export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
}

function sentinelToKind(ch: string): SqlTokenKind {
  switch (ch) {
    case SENTINEL_STR:
      return 'str';
    case SENTINEL_KW:
      return 'kw';
    case SENTINEL_FN:
      return 'fn';
    default:
      return 'num';
  }
}

/**
 * Tokeniza la SQL en pares `(kind, text)`. Devuelve un array que SqlBlock
 * pinta con `<span class="kw|fn|str|num|punc">`.
 *
 * Garantía: la concatenación de `text`s de todos los tokens recompone la
 * SQL original (verificado en el test de "reconstrucción").
 */
export function highlightSQL(sql: string): SqlToken[] {
  // Pase 1 — extraer strings literales a un side-car. Los sustituimos por
  // un par de SENTINEL_STR adyacentes para que no entren en las pasadas
  // siguientes (kw/fn/num) y no se enreden con dígitos como '2025-1'.
  const stringLiterals: string[] = [];
  let s = sql.replace(/'([^']*)'/g, (match) => {
    stringLiterals.push(match);
    return SENTINEL_STR + SENTINEL_STR;
  });

  // Pase 2 — marcar keywords/functions/numbers con sus sentinels.
  s = s
    .replace(SQL_KW, (m) => SENTINEL_KW + m + SENTINEL_KW)
    .replace(SQL_FN, (m) => SENTINEL_FN + m + SENTINEL_FN)
    .replace(/\b(\d+)\b/g, (m) => SENTINEL_NUM + m + SENTINEL_NUM);

  // Pase 3 — walk del string emitiendo tokens. El contador `strIdx` consume
  // strings del side-car en el orden en que aparecen, sin necesidad de
  // codificar índices dentro de los sentinels.
  const tokens: SqlToken[] = [];
  let buffer = '';
  let strIdx = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (
      ch === SENTINEL_STR ||
      ch === SENTINEL_KW ||
      ch === SENTINEL_FN ||
      ch === SENTINEL_NUM
    ) {
      if (buffer) {
        tokens.push({ kind: 'punc', text: buffer });
        buffer = '';
      }
      const end = s.indexOf(ch, i + 1);
      // end siempre > 0 porque emitimos los sentinels en pares balanceados.
      // Defensa por si esa invariante se rompe: si indexOf devuelve -1,
      // tratamos al sentinel como punc y seguimos en vez de loopear infinito.
      if (end === -1) {
        buffer += ch;
        continue;
      }
      const kind = sentinelToKind(ch);
      const text =
        kind === 'str' ? (stringLiterals[strIdx++] ?? '') : s.slice(i + 1, end);
      tokens.push({ kind, text });
      i = end;
    } else {
      buffer += ch;
    }
  }
  if (buffer) tokens.push({ kind: 'punc', text: buffer });
  return tokens;
}
