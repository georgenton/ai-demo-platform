// -----------------------------------------------------------------------------
// @CurrentUser() y @CurrentTenant() — decorators de parámetros para los
// controllers que necesitan saber quién está consultando.
//
// Uso típico:
//   @Get('documents')
//   list(@CurrentTenant() tenantId: string) {
//     return this.documentsService.list(tenantId);
//   }
//
// Los decoradores leen `request.user` (poblado por AuthGuard) y
// `request.tenantId` (poblado por TenantGuard). Si el endpoint olvida
// agregar el filtro al service, el service mismo recibe el tenantId
// como parámetro obligatorio — el contract acoda al programador.
// -----------------------------------------------------------------------------

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { JwtPayload } from './auth.types.js';

/**
 * Devuelve el JwtPayload completo: { sub, tid, role, email }. Útil cuando
 * el handler necesita validar role explícitamente o usar el email para
 * logging.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    return req.user;
  },
);

/**
 * Atajo para el caso más común: solo necesito el tenantId del request en
 * curso. Vuelve el string ya validado y posiblemente sobreescrito por
 * superadmin (ver TenantGuard).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { tenantId?: string }>();
    return req.tenantId;
  },
);
