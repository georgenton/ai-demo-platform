// -----------------------------------------------------------------------------
// AuthGuard — guard global que exige JWT válido en cookie 'auth'.
//
// Reglas:
//   - Si el handler tiene @Public(): pasa sin verificar.
//   - Si la cookie 'auth' no existe: 401.
//   - Si el JWT es inválido o vencido: 401.
//   - Si el JWT es válido: inyecta `request.user = JwtPayload`.
//
// El TenantGuard corre DESPUÉS del AuthGuard y usa `request.user.tid` para
// poblar `request.tenantId`. Ese tenantId NO viene de query/header/body —
// solo del JWT. Eso elimina la clase de bug "user pide tenantId ajeno".
//
// Ver ADR-0014.
// -----------------------------------------------------------------------------

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthService } from './auth.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<
        Request & { cookies?: Record<string, string>; user?: unknown }
      >();
    const token = req.cookies?.['auth'];
    if (!token) {
      throw new UnauthorizedException('No hay sesión activa.');
    }
    try {
      const payload = this.authService.verifyToken(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida.');
    }
  }
}
