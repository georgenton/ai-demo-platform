// -----------------------------------------------------------------------------
// HTTP layer del catálogo de demos.
//
// Endpoints:
//   - GET /api/v1/demos        → lista completa
//   - GET /api/v1/demos/:id    → detalle de uno (404 si no existe)
//
// Sin DTOs de input (los endpoints son de lectura sin parámetros de body) y
// la respuesta se serializa directo desde el array del service. NestJS lo
// convierte a JSON automáticamente.
// -----------------------------------------------------------------------------

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DemoRegistryService } from './demo-registry.service.js';
import { DemoMetadata } from './demo-registry.types.js';

@ApiTags('Demos')
@Controller({ path: 'demos' })
export class DemosController {
  constructor(private readonly registry: DemoRegistryService) {}

  /**
   * GET /api/v1/demos
   *
   * Devuelve el catálogo completo. Sin paginación porque tenemos un puñado
   * de demos (siempre cabe en una respuesta), y sin filtros por status —
   * la UI decide qué mostrar con la metadata que llega.
   */
  @Get()
  @ApiOperation({ summary: 'Listar el catálogo completo de demos' })
  @ApiResponse({ status: 200, type: [DemoMetadata] })
  list(): readonly DemoMetadata[] {
    return this.registry.findAll();
  }

  /**
   * GET /api/v1/demos/:id
   *
   * Detalle de un demo específico. 404 si el ID no existe.
   *
   * Por qué responder 404 explícito y no devolver null: en una API REST el
   * cliente espera 200 con el recurso o 404 si no existe. Devolver 200 + null
   * obligaría al frontend a chequear dos cosas (status + body) y abriría la
   * puerta a bugs sutiles ("se cayó la API" vs "el demo no existe").
   */
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un demo por ID' })
  @ApiResponse({ status: 200, type: DemoMetadata })
  @ApiResponse({ status: 404, description: 'Demo no existe' })
  detail(@Param('id') id: string): DemoMetadata {
    const demo = this.registry.findOne(id);
    if (!demo) {
      throw new NotFoundException(`Demo "${id}" no existe`);
    }
    return demo;
  }
}
