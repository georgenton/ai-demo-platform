// -----------------------------------------------------------------------------
// AdminController — endpoints administrativos del tenant.
//
// Toda la clase requiere @RequireRole('admin') → admin Y superadmin pueden
// entrar; member no. El RolesGuard lo enforce.
//
// PATCH /api/v1/admin/tenant — actualiza displayName, enabledDemos y/o
// branding del tenant del admin logueado. Devuelve el tenant resultante.
// -----------------------------------------------------------------------------

import { Body, Controller, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from '../auth/current-user.decorator.js';
import { RequireRole } from '../auth/require-role.decorator.js';

import { AdminService, type TenantResponse } from './admin.service.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';

@ApiTags('Admin')
@Controller({ path: 'admin' })
@RequireRole('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * PATCH /api/v1/admin/tenant
   *
   * Patch parcial del tenant del admin logueado. Solo los campos presentes
   * en el body se actualizan; el resto queda igual. El branding se mergea
   * (no destructivo) — el admin puede setear solo accentColor sin perder
   * logoUrl.
   *
   * Por qué PATCH y no PUT:
   *   PATCH es semánticamente "actualización parcial"; PUT requeriría que el
   *   cliente reenvíe el objeto completo. Para una UI de admin con varios
   *   campos editables, PATCH es más resiliente a deploys parciales del
   *   frontend (campos nuevos no pisan los existentes).
   */
  @Patch('tenant')
  @ApiOperation({
    summary: 'Actualiza el tenant del admin logueado (parcial)',
    description:
      'Permite modificar displayName, enabledDemos y branding. Solo admin/superadmin. enabledDemos se valida contra el catálogo del registry.',
  })
  @ApiResponse({ status: 200, description: 'Tenant actualizado.' })
  @ApiResponse({ status: 403, description: 'No tiene rol admin.' })
  @ApiResponse({
    status: 400,
    description: 'enabledDemos contiene IDs no presentes en el catálogo.',
  })
  async updateTenant(
    @Body() dto: UpdateTenantDto,
    @CurrentTenant() tenantId: string,
  ): Promise<TenantResponse> {
    return this.adminService.updateMyTenant(tenantId, dto);
  }
}
