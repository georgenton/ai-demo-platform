// -----------------------------------------------------------------------------
// @RequireRole(role) — anota un endpoint para que el RolesGuard rechace
// requests cuyo usuario logueado tenga un rol insuficiente.
//
// Mismo patrón que @RequireDemo / DemoAccessGuard (PR-MT3): metadata + guard
// global que la consume. Aplicable a nivel de método o de clase.
//
// Jerarquía (de menor a mayor capacidad):
//   member  → ve los demos del tenant.
//   admin   → además puede editar enabledDemos y branding del tenant.
//   superadmin → además puede ver y editar cualquier tenant.
//
// @RequireRole('admin') deja pasar admin Y superadmin. La jerarquía se
// resuelve en el RolesGuard, no acá.
// -----------------------------------------------------------------------------

import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '@org/db';

export const REQUIRE_ROLE_KEY = 'requireRole';

export const RequireRole = (role: UserRole): ClassDecorator & MethodDecorator =>
  SetMetadata(REQUIRE_ROLE_KEY, role) as ClassDecorator & MethodDecorator;
