// -----------------------------------------------------------------------------
// TenantGuard — corre después del AuthGuard. Inyecta `request.tenantId`.
//
// Solo se ejecuta cuando hay `request.user` (es decir, AuthGuard pasó). Los
// endpoints @Public() lo evitan tanto del AuthGuard como del TenantGuard
// porque no hay user → el guard sale temprano sin tocar nada.
//
// Los services del backend leen `request.tenantId` (vía decorator
// @CurrentTenant) y NUNCA aceptan tenantId desde query/body/header. Eso
// hace imposible que un user pida data de otro tenant.
//
// Excepción: `superadmin` puede pasar `?tenantId=otro` y verá ese tenant.
// Esto está pensado para Jorge y Edguitar al hacer soporte. La excepción
// queda explícita en el código y se loggea en cada uso.
// -----------------------------------------------------------------------------

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

import type { JwtPayload } from './auth.types.js';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<
      Request & {
        user?: JwtPayload;
        tenantId?: string;
        query: Record<string, string | string[] | undefined>;
      }
    >();

    // Sin user (endpoint @Public()) — nada que escopar.
    if (!req.user) return true;

    const fromJwt = req.user.tid;
    const override =
      typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;

    if (override && override !== fromJwt) {
      // Solo superadmin puede solicitar tenant ajeno via query param.
      if (req.user.role !== 'superadmin') {
        this.logger.warn(
          `User ${req.user.sub} (role=${req.user.role}) intentó tenantId=${override} sin permisos. Forzando a su tenant ${fromJwt}.`,
        );
        req.tenantId = fromJwt;
      } else {
        this.logger.log(
          `Superadmin ${req.user.email} consultando tenant=${override} (su tenant es ${fromJwt}).`,
        );
        req.tenantId = override;
      }
    } else {
      req.tenantId = fromJwt;
    }

    return true;
  }
}
