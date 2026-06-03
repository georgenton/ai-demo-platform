// -----------------------------------------------------------------------------
// RolesGuard — valida que el usuario tenga un rol suficiente para el handler
// anotado con @RequireRole().
//
// Posición en la cadena de guards (main.ts):
//   InternalKey → Auth → Tenant → DemoAccess → Roles
//
// Por qué Roles es el último: depende de req.user (puesto por AuthGuard) pero
// es ortogonal a tenant/demo. Después de Roles, el handler corre.
//
// Jerarquía (de menor a mayor capacidad):
//   member       — rol base
//   admin        — todo lo de member + edita su tenant
//   superadmin   — todo lo de admin + puede operar sobre cualquier tenant
//
// @RequireRole('admin') pasa para admin Y superadmin (jerarquía).
// @RequireRole('superadmin') pasa SOLO para superadmin.
// @RequireRole('member') pasa para los tres (poco útil, pero coherente).
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

import type { UserRole } from '@org/db';

import type { JwtPayload } from './auth.types.js';
import { REQUIRE_ROLE_KEY } from './require-role.decorator.js';

/**
 * Orden de la jerarquía. El index implica capacidad: cuanto más alto, más
 * permisos. Para chequear "¿tiene rol >= X?" comparamos índices.
 */
const ROLE_RANK: Record<UserRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole | undefined>(
      REQUIRE_ROLE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    // Sin @RequireRole() → pasa sin chequear.
    if (!required) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) {
      // Defensive: si llegamos acá sin user hay un bug de orden — AuthGuard
      // tiene que haber poblado req.user. Devolvemos 403 con mensaje claro
      // (no 401 — el problema es el orden de guards, no la auth en sí).
      throw new ForbiddenException(
        'No hay user en el request. ¿Falta AuthGuard antes que RolesGuard?',
      );
    }

    const userRank = ROLE_RANK[user.role];
    const requiredRank = ROLE_RANK[required];
    if (userRank >= requiredRank) return true;

    this.logger.warn(
      `User ${user.sub} (role=${user.role}) intentó acceder a un endpoint que requiere ${required}`,
    );
    throw new ForbiddenException(
      `Este recurso requiere rol "${required}" o superior.`,
    );
  }
}
