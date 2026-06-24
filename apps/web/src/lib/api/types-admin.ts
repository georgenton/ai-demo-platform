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

/**
 * Valores del enum `Tenant.llmProvider` que la UI puede setear (ADR-0022).
 * Espejo de `LLM_PROVIDER_CHOICES` del DTO backend menos `fake` (CI only).
 * `null` = limpiar el override y caer al `CHAT_PROVIDER` del env.
 */
export type AdminLlmProvider =
  | 'anthropic'
  | 'openai-compat'
  | 'private-mac'
  | 'private-onprem';

/** Body del PATCH /api/v1/admin/tenant. Todos los campos opcionales. */
export interface UpdateTenantRequest {
  displayName?: string;
  enabledDemos?: string[];
  branding?: TenantBrandingPatch;
  /**
   * Provider LLM del tenant (ADR-0022). Pasa `null` para limpiar el
   * override; omite el campo para no tocarlo.
   */
  llmProvider?: AdminLlmProvider | null;
}

/** Respuesta del PATCH /admin/tenant — el tenant ya actualizado + industry. */
export interface AdminTenantResponse {
  id: string;
  slug: string;
  displayName: string;
  enabledDemos: string[];
  branding: unknown;
  status: TenantStatus;
  llmProvider: string | null;
  industry: {
    slug: string;
    displayName: string;
  };
}
