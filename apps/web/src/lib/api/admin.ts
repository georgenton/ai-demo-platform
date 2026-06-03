// -----------------------------------------------------------------------------
// admin.ts — cliente HTTP del módulo admin.
//
// Hoy solo updateMyTenant() — un PATCH. Conforme el admin panel crezca
// (lista de users, audit log filtrado), se suman funciones acá.
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import type { AdminTenantResponse, UpdateTenantRequest } from './types-admin';

/**
 * PATCH /api/v1/admin/tenant
 *
 * Patch parcial del tenant del admin logueado. Backend valida que el rol
 * sea admin o superadmin (RolesGuard). 403 si no.
 *
 * Devuelve el tenant ya actualizado con merge no destructivo aplicado al
 * branding — el caller puede sobreescribir su estado local con la
 * respuesta sin volver a fetchar.
 */
export async function updateMyTenant(
  body: UpdateTenantRequest,
  signal?: AbortSignal,
): Promise<AdminTenantResponse> {
  const response = await fetch('/api/v1/admin/tenant', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as AdminTenantResponse;
}
