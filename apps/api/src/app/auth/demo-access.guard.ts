// -----------------------------------------------------------------------------
// DemoAccessGuard — rechaza requests cuyo tenant no tiene habilitado el demo
// que el handler declara con @RequireDemo().
//
// Cómo encaja en la cadena de guards:
//
//   InternalKeyGuard  →  AuthGuard  →  TenantGuard  →  DemoAccessGuard
//   (X-Internal-Key)     (JWT)         (tid → req.tenantId)  (este)
//
// Para cuando llega acá, ya sabemos: hay sesión válida y tenantId resuelto.
// Solo falta validar que el tenant tenga ese demo en su lista resuelta.
//
// Por qué un guard nuevo en lugar de meter la lógica en TenantGuard:
//   - TenantGuard corre en TODAS las rutas y no sabe nada de demos.
//   - El DemoAccessGuard solo hace una consulta a la DB si el handler
//     declara @RequireDemo(). Para rutas sin la marca, no toca la DB.
//   - Separar permite que /api/v1/me/demos pueda devolver la lista
//     completa sin auto-bloquearse a sí mismo.
// -----------------------------------------------------------------------------

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IndustryService } from '../industries/industry.service.js';

import {
  REQUIRE_DEMO_KEY,
  type RequireDemoSpec,
} from './require-demo.decorator.js';

@Injectable()
export class DemoAccessGuard implements CanActivate {
  private readonly logger = new Logger(DemoAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly industryService: IndustryService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 1) ¿El handler declara @RequireDemo()? Si no, deja pasar.
    const spec = this.reflector.getAllAndOverride<RequireDemoSpec | undefined>(
      REQUIRE_DEMO_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!spec) return true;

    // 2) Extrae el demoId final (estático o dinámico).
    const req = ctx.switchToHttp().getRequest<
      Request & {
        tenantId?: string;
        query: Record<string, unknown>;
        body: Record<string, unknown>;
      }
    >();
    const demoId = this.resolveDemoId(spec, req);
    if (!demoId) {
      throw new ForbiddenException(
        'No se pudo determinar el demo requerido. Revisa @RequireDemo() del handler.',
      );
    }

    // 3) Necesita tenantId — el TenantGuard ya tiene que haber corrido.
    const tenantId = req.tenantId;
    if (!tenantId) {
      // Defensive: si llegamos acá sin tenantId hay un bug de orden de
      // guards. Mejor 403 explícito que dejar pasar silenciosamente.
      throw new ForbiddenException(
        'No hay tenantId en el request. ¿Falta TenantGuard antes que DemoAccessGuard?',
      );
    }

    // 4) Consulta al IndustryService. Si no calza, 403.
    const allowed = await this.industryService.hasDemo(tenantId, demoId);
    if (!allowed) {
      this.logger.warn(
        `Tenant ${tenantId} intentó acceder al demo "${demoId}" sin tenerlo habilitado`,
      );
      throw new ForbiddenException(
        `El demo "${demoId}" no está habilitado para tu organización. ` +
          `Si necesitas acceso, contacta al administrador.`,
      );
    }
    return true;
  }

  /** Resuelve el demoId final desde la spec del decorator. */
  private resolveDemoId(
    spec: RequireDemoSpec,
    req: {
      query: Record<string, unknown>;
      body: Record<string, unknown>;
    },
  ): string | undefined {
    if (typeof spec === 'string') return spec;

    const source = spec.from === 'query' ? req.query : req.body;
    const value = source?.[spec.key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
