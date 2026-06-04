// -----------------------------------------------------------------------------
// MeController — endpoints "yo": información del usuario y tenant logueados.
//
// Por qué un controller "/me" separado en lugar de meter esto en /auth/me:
//   - /auth/me ya devuelve el JWT payload deserializado.
//   - /me/demos cruza varias entidades (Tenant + Industry + DemoRegistry) y
//     aplica la regla de herencia de ADR-0013. Es trabajo de un módulo de
//     dominio (industries), no del auth.
//   - Mantiene cada módulo con su responsabilidad acotada.
// -----------------------------------------------------------------------------

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { DemoRegistryService } from '../demos/demo-registry.service.js';
import { IndustryService } from '../industries/industry.service.js';

import { MeDemosResponseDto } from './dto/me-demos-response.dto.js';

@ApiTags('Me')
@Controller({ path: 'me' })
export class MeController {
  constructor(
    private readonly industryService: IndustryService,
    private readonly demoRegistry: DemoRegistryService,
  ) {}

  /**
   * GET /api/v1/me/demos
   *
   * Devuelve la cartelera FINAL del tenant del usuario logueado:
   *   - Lista filtrada de demos (solo los habilitados, con su metadata
   *     completa del registry).
   *   - Info del tenant (branding, displayName, status).
   *   - Info de la industry (default config, copy).
   *   - Flag `overridden`: true si el tenant pisó la default.
   *
   * El frontend usa esto para pintar el dashboard sin tener que conocer la
   * regla de herencia ni filtrar por sí mismo.
   */
  @Get('demos')
  @ApiOperation({
    summary: 'Demos habilitados para el tenant del usuario logueado',
    description:
      'Aplica la regla de herencia ADR-0013: si Tenant.enabledDemos está vacío, hereda Industry.enabledDemos; si no, override del tenant. Devuelve la lista final con metadata completa del registry.',
  })
  @ApiResponse({ status: 200, type: MeDemosResponseDto })
  async demos(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MeDemosResponseDto> {
    const resolved = await this.industryService.resolveEnabledDemos(tenantId);

    // Superadmin bypass: el rol 'superadmin' administra la plataforma entera
    // (no un tenant específico). Para poder ver/QA todos los demos al hacer
    // smoke tests en producción, devolvemos el catálogo completo en vez de
    // filtrar por enabledDemos. Sin esto, un demo nuevo registrado para una
    // industria (ej. Demo 06 para 'salud') no se vería desde la cuenta del
    // superadmin si su tenant interno está en otra industria.
    //
    // No es relajación de permisos: el DemoAccessGuard sigue chequeando
    // `enabledDemos` en cada request al demo — solo cambiamos qué se
    // muestra en la cartelera.
    const allDemos = this.demoRegistry.findAll();
    const demos =
      user.role === 'superadmin'
        ? [...allDemos]
        : allDemos.filter((demo) =>
            new Set(resolved.enabledDemos).has(demo.id),
          );

    return {
      tenant: resolved.tenant,
      industry: resolved.industry,
      demos,
      overridden: resolved.overridden,
    };
  }
}
