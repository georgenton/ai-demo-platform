// -----------------------------------------------------------------------------
// AdminService — operaciones de administración del tenant.
//
// Por ahora solo updateMyTenant() (PATCH /admin/tenant). Conforme crezca el
// admin panel (ver/crear users, ver audit log filtrado, etc.) acá se suman
// más métodos.
//
// Reglas de seguridad (ADR-0013):
//   - El admin solo puede mutar SU tenant (req.tenantId). Si quisiera tocar
//     otro, el TenantGuard ya filtra (admin no tiene override).
//   - Solo se permiten campos del DTO. enabledDemos se valida contra el
//     catálogo de demos en memoria (DemoRegistryService) para evitar que un
//     admin meta un demoId inexistente que rompería el dashboard.
// -----------------------------------------------------------------------------

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { prisma } from '@org/db';

import { DemoRegistryService } from '../demos/demo-registry.service.js';

import type { UpdateTenantDto } from './dto/update-tenant.dto.js';

/**
 * Forma de la respuesta — explicitada para no exponer tipos generados de
 * Prisma en la firma pública (que generan warnings de portabilidad en el
 * dts).
 */
export interface TenantResponse {
  id: string;
  slug: string;
  displayName: string;
  enabledDemos: string[];
  branding: unknown;
  status: 'active' | 'trial' | 'suspended';
  industry: {
    slug: string;
    displayName: string;
  };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly demoRegistry: DemoRegistryService) {}

  /**
   * Aplica un patch parcial al tenant. Devuelve el tenant actualizado para
   * que el frontend refleje el cambio sin un segundo fetch.
   *
   * Merge de branding: si el DTO trae `branding`, lo fusionamos con el
   * existente — así el admin puede setear solo accentColor sin perder el
   * logoUrl que ya estaba.
   */
  async updateMyTenant(
    tenantId: string,
    patch: UpdateTenantDto,
  ): Promise<TenantResponse> {
    // 1) Existencia del tenant (defensive — el TenantGuard ya garantiza
    //    que tenantId proviene de un JWT válido).
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Tenant "${tenantId}" no existe`);
    }

    // 2) Validación de enabledDemos contra el catálogo en memoria.
    if (patch.enabledDemos !== undefined) {
      const catalogIds = new Set(this.demoRegistry.findAll().map((d) => d.id));
      const invalid = patch.enabledDemos.filter((id) => !catalogIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `enabledDemos contiene IDs inválidos: ${invalid.join(', ')}. ` +
            `Válidos: ${Array.from(catalogIds).join(', ')}.`,
        );
      }
    }

    // 3) Merge de branding (no destructivo).
    let mergedBranding: unknown = existing.branding;
    if (patch.branding !== undefined) {
      const current =
        existing.branding && typeof existing.branding === 'object'
          ? (existing.branding as Record<string, unknown>)
          : {};
      mergedBranding = { ...current, ...patch.branding };
    }

    // 4) Update parcial. Prisma ignora campos `undefined` automáticamente.
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        displayName: patch.displayName,
        enabledDemos: patch.enabledDemos,
        branding:
          patch.branding !== undefined ? (mergedBranding as object) : undefined,
      },
      include: { industry: true },
    });

    this.logger.log(
      `Tenant ${tenantId} updated (fields=${Object.keys(patch).join(', ')})`,
    );

    return {
      id: updated.id,
      slug: updated.slug,
      displayName: updated.displayName,
      enabledDemos: updated.enabledDemos,
      branding: updated.branding,
      status: updated.status,
      industry: {
        slug: updated.industry.slug,
        displayName: updated.industry.displayName,
      },
    };
  }
}
