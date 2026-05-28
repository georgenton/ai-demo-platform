// Tests del helper extractTip.
//
// Lo que verificamos: aislamiento del cuerpo y del tip para las variantes
// de prefijo que el LLM produce, sin pegarse a un único formato exacto.

import { describe, expect, it } from 'vitest';

import { extractTip } from './extract-tip';

describe('extractTip', () => {
  it('sin tip → body = text, tip = null', () => {
    expect(extractTip('Nice weekend! What did you do?')).toEqual({
      body: 'Nice weekend! What did you do?',
      tip: null,
    });
  });

  it('extrae el tip con prefijo simple "💡 Tip:"', () => {
    const text =
      'Nice weekend!\n\n💡 Tip: en pasado simple usá "went" en vez de "go".';
    expect(extractTip(text)).toEqual({
      body: 'Nice weekend!',
      tip: 'en pasado simple usá "went" en vez de "go".',
    });
  });

  it('extrae el tip con prefijo en negrita "💡 **Tip:**"', () => {
    const text = 'Cool!\n\n💡 **Tip:** "I went", no "I go".';
    expect(extractTip(text).tip).toBe('"I went", no "I go".');
  });

  it('toma el primer tip si hubiera más de uno', () => {
    const text = 'Reply.\n\n💡 Tip: primero.\n\n💡 Tip: segundo.';
    expect(extractTip(text).tip).toBe('primero.\n\n💡 Tip: segundo.');
  });

  it('trim del body y del tip', () => {
    const text = 'Reply.   \n\n💡 Tip:   con espacios extras.   ';
    expect(extractTip(text)).toEqual({
      body: 'Reply.',
      tip: 'con espacios extras.',
    });
  });

  it('tip vacío después del prefijo → tip = null', () => {
    expect(extractTip('Reply. 💡 Tip:   ').tip).toBeNull();
  });
});
