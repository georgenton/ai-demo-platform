// -----------------------------------------------------------------------------
// HTTP layer del catálogo de demos.
//
// Endpoints:
//   - GET /api/v1/demos        → lista filtrada por enabledDemos del tenant
//   - GET /api/v1/demos/:id    → detalle (404 si no existe o no habilitado)
//
// Multi-tenant (ADR-0013 + PR-MT3): el catálogo se filtra por la cartelera
// resuelta del tenant. Devolver el catálogo completo abriría un info leak
// — el cliente sabría qué demos existen aunque no le sirvan. 404 cuando un
// tenant pide un demo no habilitado: mismo mensaje que "no existe".
// -----------------------------------------------------------------------------

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from '../auth/current-user.decorator.js';
import { IndustryService } from '../industries/industry.service.js';

import { DemoRegistryService } from './demo-registry.service.js';
import { DemoMetadata } from './demo-registry.types.js';

@ApiTags('Demos')
@Controller({ path: 'demos' })
export class DemosController {
  constructor(
    private readonly registry: DemoRegistryService,
    private readonly industryService: IndustryService,
  ) {}

  /**
   * GET /api/v1/demos
   *
   * Devuelve la cartelera del tenant en curso: el catálogo del registry,
   * filtrado por la lista resuelta de enabledDemos (ADR-0013, regla de
   * herencia industry → tenant). Sin paginación porque el set es chico.
   */
  @Get()
  @ApiOperation({
    summary: 'Listar catálogo de demos habilitados para mi tenant',
  })
  @ApiResponse({ status: 200, type: [DemoMetadata] })
  async list(
    @CurrentTenant() tenantId: string,
  ): Promise<readonly DemoMetadata[]> {
    const resolved = await this.industryService.resolveEnabledDemos(tenantId);
    const enabledSet = new Set(resolved.enabledDemos);
    return this.registry.findAll().filter((demo) => enabledSet.has(demo.id));
  }

  /**
   * GET /api/v1/demos/:id
   *
   * Detalle de un demo. 404 cuando:
   *   - el ID no existe en el registry, O
   *   - el tenant no tiene ese demo habilitado.
   *
   * Mismo mensaje genérico en ambos casos para no filtrar la existencia
   * de demos no disponibles al tenant — info leak chico, pero gratis de
   * cerrar.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un demo habilitado para mi tenant' })
  @ApiResponse({ status: 200, type: DemoMetadata })
  @ApiResponse({ status: 404, description: 'Demo no existe o no habilitado' })
  async detail(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<DemoMetadata> {
    const demo = this.registry.findOne(id);
    if (!demo) {
      throw new NotFoundException(`Demo "${id}" no existe`);
    }
    const allowed = await this.industryService.hasDemo(tenantId, id);
    if (!allowed) {
      // Mismo mensaje que "no existe" — no confirmamos que el demo exista
      // pero esté apagado para este tenant.
      throw new NotFoundException(`Demo "${id}" no existe`);
    }
    return demo;
  }
}
