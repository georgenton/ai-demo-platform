// -----------------------------------------------------------------------------
// Tests del InternalKeyGuard. Cubren los tres caminos:
//   1) INTERNAL_API_KEY vacío → guard inactivo, todas las rutas pasan.
//   2) INTERNAL_API_KEY seteado, header válido → permite.
//   3) INTERNAL_API_KEY seteado, header ausente/inválido → 401.
//   4) /api/v1/health pasa sin header incluso con guard activo.
// -----------------------------------------------------------------------------

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InternalKeyGuard } from './internal-key.guard.js';

function makeContext(path: string, headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('InternalKeyGuard', () => {
  const ORIGINAL = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    delete process.env.INTERNAL_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL !== undefined) process.env.INTERNAL_API_KEY = ORIGINAL;
    else delete process.env.INTERNAL_API_KEY;
  });

  it('sin INTERNAL_API_KEY: guard inactivo, pasa cualquier ruta sin header', () => {
    const guard = new InternalKeyGuard();
    expect(guard.canActivate(makeContext('/api/v1/chat'))).toBe(true);
    expect(guard.canActivate(makeContext('/api/v1/agent/stream'))).toBe(true);
  });

  it('con INTERNAL_API_KEY: header correcto → permite', () => {
    process.env.INTERNAL_API_KEY = 'shh-secret';
    const guard = new InternalKeyGuard();
    const ctx = makeContext('/api/v1/chat', { 'x-internal-key': 'shh-secret' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('con INTERNAL_API_KEY: header ausente → 401', () => {
    process.env.INTERNAL_API_KEY = 'shh-secret';
    const guard = new InternalKeyGuard();
    expect(() => guard.canActivate(makeContext('/api/v1/chat'))).toThrow(
      UnauthorizedException,
    );
  });

  it('con INTERNAL_API_KEY: header incorrecto → 401', () => {
    process.env.INTERNAL_API_KEY = 'shh-secret';
    const guard = new InternalKeyGuard();
    const ctx = makeContext('/api/v1/chat', { 'x-internal-key': 'wrong' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('/api/v1/health pasa sin header incluso con guard activo', () => {
    process.env.INTERNAL_API_KEY = 'shh-secret';
    const guard = new InternalKeyGuard();
    expect(guard.canActivate(makeContext('/api/v1/health'))).toBe(true);
  });
});
