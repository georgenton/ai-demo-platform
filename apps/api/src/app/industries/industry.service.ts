// -----------------------------------------------------------------------------
// IndustryService — resuelve qué demos están habilitados para un tenant.
//
// Regla de herencia (ADR-0013, slide 49 del deck):
//
//   resolveEnabledDemos(tenant) =
//     tenant.enabledDemos.length > 0
//       ? tenant.enabledDemos      // override explícito
//       : tenant.industry.enabledDemos  // default por industria
//
// El `[]` del tenant significa "usá la default de mi industry". Si el admin
// edita la lista del tenant (aunque sea para sacar UN demo), pasa a ser
// override total — no es merge ni diff. Eso simplifica la mental model:
// "¿qué demos tiene este tenant? Lo que diga su columna, salvo que esté
// vacía → entonces lo que diga la industry."
//
// Este service es la ÚNICA fuente de verdad para esa pregunta. Cualquier
// otro módulo (DemoAccessGuard, MeController) la consume desde acá.
// -----------------------------------------------------------------------------

import { Injectable, NotFoundException } from '@nestjs/common';

import { prisma } from '@org/db';

/**
 * Forma resuelta — lo que el frontend necesita pintar el dashboard:
 * lista final de demos + metadata del tenant + metadata del industry.
 */
export interface ResolvedTenantDemos {
  tenant: {
    id: string;
    slug: string;
    displayName: string;
    branding: unknown; // JSON sin schema fijo — el front decide qué leer.
    status: 'active' | 'trial' | 'suspended';
  };
  industry: {
    slug: string;
    displayName: string;
    defaultConfig: unknown;
  };
  /** Lista final ya con override aplicado. Lo que el front debe pintar. */
  enabledDemos: string[];
  /** True si la lista vino del override del tenant, false si heredó. Útil
   *  para mostrar "personalizado" vs "default de industria" en el admin. */
  overridden: boolean;
}

@Injectable()
export class IndustryService {
  /**
   * Resuelve la lista final de demos para un tenant. Si el tenant no existe,
   * lanza NotFoundException — pero en práctica el tenantId viene del JWT
   * vía TenantGuard, así que solo pasa si la DB está inconsistente o un
   * superadmin pasó un tenantId inventado en el query param.
   */
  async resolveEnabledDemos(tenantId: string): Promise<ResolvedTenantDemos> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { industry: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant "${tenantId}" no existe`);
    }

    // Override si la lista del tenant trae al menos un demo; si no, default
    // de la industry. El cast a string[] es seguro: schema declara String[].
    const tenantOverride = (tenant.enabledDemos ?? []) as string[];
    const overridden = tenantOverride.length > 0;
    const enabledDemos = overridden
      ? tenantOverride
      : ((tenant.industry.enabledDemos ?? []) as string[]);

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        displayName: tenant.displayName,
        branding: tenant.branding,
        status: tenant.status,
      },
      industry: {
        slug: tenant.industry.slug,
        displayName: tenant.industry.displayName,
        defaultConfig: tenant.industry.defaultConfig,
      },
      enabledDemos,
      overridden,
    };
  }

  /**
   * Check rápido para los guards: ¿este tenant tiene habilitado este demo?
   * Reutiliza resolveEnabledDemos — una sola query a la DB por request.
   */
  async hasDemo(tenantId: string, demoId: string): Promise<boolean> {
    const resolved = await this.resolveEnabledDemos(tenantId);
    return resolved.enabledDemos.includes(demoId);
  }
}
