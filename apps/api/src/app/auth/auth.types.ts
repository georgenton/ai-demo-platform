// -----------------------------------------------------------------------------
// Tipos compartidos del módulo Auth (ADR-0014).
//
// El JwtPayload viaja firmado dentro de la cookie httpOnly. Es la "identidad
// del usuario" que el resto del backend consume. Todo lo que aparece acá
// es público — no metas secretos.
// -----------------------------------------------------------------------------

import type { UserRole } from '@org/db';

/**
 * Payload del JWT. `sub` es el userId (estándar JWT). `tid` es el tenantId.
 * Mantenemos los nombres cortos para que el token quede chico — viaja en
 * cada request.
 */
export interface JwtPayload {
  /** User ID (subject claim del JWT). */
  sub: string;
  /** Tenant al que pertenece el user. Para superadmin es el tenant interno. */
  tid: string;
  /** Rol dentro del tenant. */
  role: UserRole;
  /** Email — duplicado para evitar lookups innecesarios en logs. */
  email: string;
}

/**
 * Lo que devuelven los endpoints públicos del módulo auth (login + me).
 * Tenant y user con campos seguros (sin password hash).
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    slug: string;
    displayName: string;
    industrySlug: string;
    enabledDemos: string[];
    branding: Record<string, unknown>;
    status: string;
  };
}

/**
 * Augmenta el Request de Express para que TypeScript sepa que `request.user`
 * existe después del AuthGuard. Cada controller que lo lee con
 * `@Req() req: AuthenticatedRequest` recibe los tipos correctos.
 */
export interface AuthenticatedRequest {
  user: JwtPayload;
}
