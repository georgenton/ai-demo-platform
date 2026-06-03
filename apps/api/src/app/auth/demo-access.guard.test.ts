// -----------------------------------------------------------------------------
// Tests del DemoAccessGuard — la última capa de los guards (después de Auth y
// Tenant), valida que el tenant tenga el demo habilitado.
//
// Cubre los 4 casos relevantes:
//   - Sin @RequireDemo() → pasa.
//   - @RequireDemo('rag') estático y tenant lo tiene → pasa.
//   - @RequireDemo('rag') estático y tenant NO lo tiene → 403.
//   - @RequireDemo({ from: 'query', key: 'demoId' }) dinámico → resuelve y valida.
//   - Sin tenantId en el request → 403 (defensive, guard mal ordenado).
// -----------------------------------------------------------------------------

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DemoAccessGuard } from './demo-access.guard.js';
import type { IndustryService } from '../industries/industry.service.js';

/**
 * Construye un ExecutionContext mínimo. Solo nos importa que getHandler /
 * getClass devuelvan algo identificable para que Reflector funcione, y que
 * switchToHttp().getRequest() devuelva el request fake.
 */
function makeCtx(req: object): ExecutionContext {
  // El Reflector espera handlers como callables — un noop alcanza para que
  // getAllAndOverride no explote en el spy (igual lo mockeamos por test).
  const handler = () => undefined;
  return {
    getHandler: () => handler,
    getClass: () => handler,
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('DemoAccessGuard', () => {
  let reflector: Reflector;
  let industryService: { hasDemo: ReturnType<typeof vi.fn> };
  let guard: DemoAccessGuard;

  beforeEach(() => {
    reflector = new Reflector();
    industryService = {
      hasDemo: vi.fn(),
    };
    guard = new DemoAccessGuard(
      reflector,
      industryService as unknown as IndustryService,
    );
  });

  it('deja pasar cuando el handler NO declara @RequireDemo()', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = await guard.canActivate(
      makeCtx({ tenantId: 'tenant-A', query: {}, body: {} }),
    );

    expect(result).toBe(true);
    expect(industryService.hasDemo).not.toHaveBeenCalled();
  });

  it('deja pasar con spec estática cuando el tenant tiene el demo', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('comparator');
    industryService.hasDemo.mockResolvedValue(true);

    const result = await guard.canActivate(
      makeCtx({ tenantId: 'tenant-A', query: {}, body: {} }),
    );

    expect(result).toBe(true);
    expect(industryService.hasDemo).toHaveBeenCalledWith(
      'tenant-A',
      'comparator',
    );
  });

  it('lanza 403 con spec estática cuando el tenant NO tiene el demo', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('tutor');
    industryService.hasDemo.mockResolvedValue(false);

    await expect(
      guard.canActivate(makeCtx({ tenantId: 'tenant-A', query: {}, body: {} })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resuelve demoId dinámico desde query string', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      from: 'query',
      key: 'demoId',
    });
    industryService.hasDemo.mockResolvedValue(true);

    const result = await guard.canActivate(
      makeCtx({
        tenantId: 'tenant-A',
        query: { demoId: 'rag' },
        body: {},
      }),
    );

    expect(result).toBe(true);
    expect(industryService.hasDemo).toHaveBeenCalledWith('tenant-A', 'rag');
  });

  it('resuelve demoId dinámico desde body JSON', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      from: 'body',
      key: 'demoId',
    });
    industryService.hasDemo.mockResolvedValue(true);

    const result = await guard.canActivate(
      makeCtx({
        tenantId: 'tenant-A',
        query: {},
        body: { demoId: 'rag' },
      }),
    );

    expect(result).toBe(true);
    expect(industryService.hasDemo).toHaveBeenCalledWith('tenant-A', 'rag');
  });

  it('lanza 403 si la spec es dinámica pero el campo no llegó', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      from: 'query',
      key: 'demoId',
    });

    await expect(
      guard.canActivate(makeCtx({ tenantId: 'tenant-A', query: {}, body: {} })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanza 403 si no hay tenantId en el request (orden de guards mal)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('rag');

    await expect(
      guard.canActivate(makeCtx({ query: {}, body: {} })),
    ).rejects.toThrow(ForbiddenException);
  });
});
