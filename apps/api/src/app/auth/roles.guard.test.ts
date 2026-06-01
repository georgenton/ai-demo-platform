// -----------------------------------------------------------------------------
// Tests del RolesGuard — chequeo de jerarquía.
//
// Cubre los casos clave:
//   - Sin @RequireRole → pasa.
//   - Rol exacto → pasa.
//   - Rol más alto (superadmin requesting admin endpoint) → pasa.
//   - Rol más bajo (member requesting admin endpoint) → 403.
//   - Sin user en request → 403 (defensive, orden de guards mal).
// -----------------------------------------------------------------------------

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard.js';

function makeCtx(req: object): ExecutionContext {
  const handler = () => undefined;
  return {
    getHandler: () => handler,
    getClass: () => handler,
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

const user = (role: 'member' | 'admin' | 'superadmin') => ({
  sub: 'u1',
  tid: 't1',
  email: 'u@nai.local',
  role,
});

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('deja pasar cuando el handler NO declara @RequireRole()', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeCtx({ user: user('member') }))).toBe(true);
  });

  it('deja pasar con rol exacto al requerido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('admin');
    expect(guard.canActivate(makeCtx({ user: user('admin') }))).toBe(true);
  });

  it('deja pasar con rol más alto que el requerido (jerarquía)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('admin');
    expect(guard.canActivate(makeCtx({ user: user('superadmin') }))).toBe(true);
  });

  it('lanza 403 con rol más bajo que el requerido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('admin');
    expect(() => guard.canActivate(makeCtx({ user: user('member') }))).toThrow(
      ForbiddenException,
    );
  });

  it('@RequireRole("superadmin") rechaza incluso a admin', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('superadmin');
    expect(() => guard.canActivate(makeCtx({ user: user('admin') }))).toThrow(
      ForbiddenException,
    );
  });

  it('lanza 403 si no hay user en el request (orden de guards mal)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('admin');
    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException);
  });
});
