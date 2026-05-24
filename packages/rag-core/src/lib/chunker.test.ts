// Tests del SlidingWindowChunker.
// Pura lógica de strings → muy testeable sin mocks.

import { describe, it, expect } from 'vitest';

import { SlidingWindowChunker } from './chunker.js';

describe('SlidingWindowChunker — validación del constructor', () => {
  it('lanza si size <= 0', () => {
    expect(() => new SlidingWindowChunker({ size: 0, overlap: 0 })).toThrow(
      /size/,
    );
    expect(() => new SlidingWindowChunker({ size: -1, overlap: 0 })).toThrow(
      /size/,
    );
  });

  it('lanza si overlap < 0', () => {
    expect(() => new SlidingWindowChunker({ size: 10, overlap: -1 })).toThrow(
      /overlap/,
    );
  });

  it('lanza si overlap >= size (se solaparía consigo mismo)', () => {
    expect(() => new SlidingWindowChunker({ size: 10, overlap: 10 })).toThrow(
      /overlap/,
    );
    expect(() => new SlidingWindowChunker({ size: 10, overlap: 15 })).toThrow(
      /overlap/,
    );
  });
});

describe('SlidingWindowChunker — split()', () => {
  it('devuelve array vacío para texto vacío', () => {
    const c = new SlidingWindowChunker({ size: 100, overlap: 10 });
    expect(c.split('')).toEqual([]);
  });

  it('devuelve array vacío para texto que solo tiene whitespace', () => {
    const c = new SlidingWindowChunker({ size: 100, overlap: 10 });
    expect(c.split('   \n\t  ')).toEqual([]);
  });

  it('devuelve un solo chunk si el texto es más corto que size', () => {
    const c = new SlidingWindowChunker({ size: 100, overlap: 10 });
    expect(c.split('Hola mundo')).toEqual(['Hola mundo']);
  });

  it('hace trim del texto antes de chunkear', () => {
    const c = new SlidingWindowChunker({ size: 100, overlap: 0 });
    expect(c.split('   hello   ')).toEqual(['hello']);
  });

  it('parte texto largo en ventanas con solapamiento', () => {
    // size=4, overlap=1, step=3 -> ventanas: [0..4), [3..7), [6..10)
    const c = new SlidingWindowChunker({ size: 4, overlap: 1 });
    expect(c.split('abcdefghij')).toEqual(['abcd', 'defg', 'ghij']);
  });

  it('overlap=0 produce chunks no solapados', () => {
    const c = new SlidingWindowChunker({ size: 3, overlap: 0 });
    expect(c.split('abcdefghi')).toEqual(['abc', 'def', 'ghi']);
  });

  it('chunks vienen en orden — el índice de la DB es la posición del array', () => {
    const c = new SlidingWindowChunker({ size: 3, overlap: 0 });
    const result = c.split('XYZABC');
    expect(result[0]).toBe('XYZ');
    expect(result[1]).toBe('ABC');
  });
});
