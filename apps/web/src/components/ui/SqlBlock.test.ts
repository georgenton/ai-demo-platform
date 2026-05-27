// Tests del SQL highlighter (highlightSQL).
//
// La función es la única pieza con lógica del paquete de primitives
// (el resto son wrappers de markup que el browser pinta o no). Cubrimos:
//   - Keywords/functions reconocidos.
//   - Strings 'literal' aislados (no marcamos keywords adentro).
//   - Numbers aislados.
//   - Texto sin matches → un solo token .punc.

import { describe, expect, it } from 'vitest';

// Importamos del módulo .ts puro (sin JSX) — vitest no puede parsear .tsx
// porque el tsconfig de Next.js setea `jsx: preserve`. El componente
// `SqlBlock` reexporta esto, pero acá vamos directo al source de la lógica.
import { highlightSQL } from './highlight-sql';

describe('highlightSQL', () => {
  it('marca SELECT/FROM/WHERE como keywords', () => {
    const tokens = highlightSQL('SELECT * FROM students WHERE id = 1');
    const kws = tokens.filter((t) => t.kind === 'kw').map((t) => t.text);
    expect(kws).toEqual(['SELECT', 'FROM', 'WHERE']);
  });

  it('marca COUNT/AVG como functions', () => {
    const tokens = highlightSQL('SELECT COUNT(*), AVG(score) FROM grades');
    const fns = tokens.filter((t) => t.kind === 'fn').map((t) => t.text);
    expect(fns).toEqual(['COUNT', 'AVG']);
  });

  it('preserva strings literales como un único token str con las comillas', () => {
    const tokens = highlightSQL("WHERE term = '2025-1'");
    const str = tokens.find((t) => t.kind === 'str');
    expect(str?.text).toBe("'2025-1'");
  });

  it('NO marca keywords dentro de strings literales', () => {
    // 'SELECT this' es un literal — no debe aparecer SELECT como keyword.
    const tokens = highlightSQL("WHERE name = 'SELECT this'");
    const kws = tokens.filter((t) => t.kind === 'kw').map((t) => t.text);
    expect(kws).toEqual(['WHERE']);
    const str = tokens.find((t) => t.kind === 'str');
    expect(str?.text).toBe("'SELECT this'");
  });

  it('marca números como tokens .num', () => {
    const tokens = highlightSQL('LIMIT 10 OFFSET 20');
    const nums = tokens.filter((t) => t.kind === 'num').map((t) => t.text);
    expect(nums).toEqual(['10', '20']);
  });

  it('texto plano sin matches → un solo token .punc', () => {
    const tokens = highlightSQL('foo bar baz');
    expect(tokens).toEqual([{ kind: 'punc', text: 'foo bar baz' }]);
  });

  it('SQL completa multi-línea: kws + fn + str + num + punc en orden', () => {
    const sql =
      "SELECT COUNT(*) AS total\nFROM enrollments\nWHERE term = '2025-1'\nLIMIT 5";
    const tokens = highlightSQL(sql);
    // Verificamos que reconstruyendo en orden recuperamos la SQL original.
    const reconstructed = tokens.map((t) => t.text).join('');
    expect(reconstructed).toBe(sql);
    // Y que vimos todo lo que esperábamos.
    expect(tokens.some((t) => t.kind === 'kw' && t.text === 'SELECT')).toBe(
      true,
    );
    expect(tokens.some((t) => t.kind === 'fn' && t.text === 'COUNT')).toBe(
      true,
    );
    expect(tokens.some((t) => t.kind === 'str' && t.text === "'2025-1'")).toBe(
      true,
    );
    expect(tokens.some((t) => t.kind === 'num' && t.text === '5')).toBe(true);
  });
});
