// -----------------------------------------------------------------------------
// TokenQuotaGuard — pre-check del rate limit antes de que el controller llame
// al LLM.
//
// Corre DESPUÉS del AuthGuard (necesita `req.user`). Si el user excedió su
// cuota en la última hora, lanza 429 antes de tocar el LLM. Si el user es
// `superadmin`, bypass.
//
// Uso típico en un controller:
//   @UseGuards(AuthGuard, TokenQuotaGuard)
//   @Post('chat')
//   chat(...) { ... }
//
// El controller NO necesita pasar parámetros — el guard lee `req.user`.
// -----------------------------------------------------------------------------

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import type { JwtPayload } from '../auth/auth.types.js';

import { TokenQuotaService } from './token-quota.service.js';

@Injectable()
export class TokenQuotaGuard implements CanActivate {
  constructor(private readonly quota: TokenQuotaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    // Sin user no hay quota que chequear — el AuthGuard ya rechazó si era
    // necesario. Endpoints @Public() pasan derecho.
    if (!req.user) return true;

    await this.quota.assertWithinQuota(req.user.sub, req.user.role);
    return true;
  }
}
