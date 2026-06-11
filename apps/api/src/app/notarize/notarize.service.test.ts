// -----------------------------------------------------------------------------
// Tests focalizados en `sanitizeErrorMessage` del NotarizeService.
//
// Defense in depth: además de la sanitización que el PolygonNotaryAdapter
// hace internamente, el service redacta una vez más antes de persistir el
// errorMessage y devolverlo al frontend. Esto cubre el caso de que el
// adapter (o ethers, o prisma, o cualquier capa intermedia) deje pasar
// algún secreto.
//
// Hallazgo Codex sub-PR 4: el service originalmente devolvía
// `err.message.slice(0, 200)` raw, lo que propagaba leaks heredados de
// los adapters.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { sanitizeErrorMessage } from './notarize.service.js';

describe('sanitizeErrorMessage', () => {
  it('strings desconocidos → "error desconocido"', () => {
    expect(sanitizeErrorMessage(undefined, [])).toBe('error desconocido');
    expect(sanitizeErrorMessage({ random: 'object' }, [])).toBe(
      'error desconocido',
    );
  });

  it('Error → propaga el message sin stack', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n  at internal/path/file.ts:10';
    const out = sanitizeErrorMessage(err, []);
    expect(out).toBe('boom');
    expect(out).not.toContain('internal/path');
  });

  it('redacta URLs http(s) en cualquier posición', () => {
    const out = sanitizeErrorMessage(
      new Error(
        'failed: https://rpc.internal:8545/v1?key=abc connection refused',
      ),
      [],
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('rpc.internal');
    expect(out).not.toContain('abc');
    expect(out).toContain('connection refused');
  });

  it('redacta wallet keys (0x + 64 hex)', () => {
    const key =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const out = sanitizeErrorMessage(
      new Error(`failed signing with ${key}`),
      [],
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('1234567890abcdef');
  });

  it('redacta los secrets literales pasados (RPC URL, master key)', () => {
    const RPC = 'https://my-rpc.example.com/secret-token-xyz';
    const MASTER = 'a'.repeat(64);
    const out = sanitizeErrorMessage(
      new Error(`request to ${RPC} with auth ${MASTER} failed`),
      [RPC, MASTER],
    );
    expect(out).not.toContain('my-rpc');
    expect(out).not.toContain('secret-token-xyz');
    expect(out).not.toContain(MASTER);
    expect(out).toContain('[REDACTED]');
  });

  it('ignora secrets vacíos (no redacta el mensaje entero)', () => {
    const out = sanitizeErrorMessage(new Error('connection refused'), [
      '',
      '',
      '',
    ]);
    expect(out).toBe('connection refused');
    expect(out).not.toContain('[REDACTED]');
  });

  it('trunca a maxChars después de redactar (no antes)', () => {
    // Si truncáramos antes de redactar, un secret largo podría perder los
    // últimos chars del prefix [REDACTED] y volver a verse.
    const longSecret = 'https://internal:8545/' + 'x'.repeat(400);
    const out = sanitizeErrorMessage(
      new Error(`error: ${longSecret} fin`),
      [],
      100,
    );
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out).not.toContain('internal');
    expect(out).not.toContain('xxxx');
  });

  it('mensaje sólo de secretos → "error sanitizado" (no string vacío)', () => {
    const out = sanitizeErrorMessage(
      new Error('https://a.b/c https://d.e/f'),
      [],
    );
    expect(out).toBe('error sanitizado');
  });
});
