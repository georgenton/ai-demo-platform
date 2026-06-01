// -----------------------------------------------------------------------------
// Tipos del módulo admin — espejo de apps/api/src/app/admin/dto + service.
//
// ADR-0010: duplicación manual. Sin contracts pkg compartido.
// -----------------------------------------------------------------------------

import type { TenantStatus } from './types-auth';

/** Subobjeto branding aceptado por el PATCH. Todos opcionales. */
export interface TenantBrandingPatch {
  logoUrl?: string;
  accentColor?: string;
  displayName?: string;
}

/** Body del PATCH /api/v1/admin/tenant. Todos los campos opcionales. */
export interface UpdateTenantRequest {
  displayName?: string;
  enabledDemos?: string[];
  branding?: TenantBrandingPatch;
}

/** Respuesta del PATCH /admin/tenant — el tenant ya actualizado + industry. */
export interface AdminTenantResponse {
  id: string;
  slug: string;
  displayName: string;
  enabledDemos: string[];
  branding: unknown;
  status: TenantStatus;
  industry: {
    slug: string;
    displayName: string;
  };
}
