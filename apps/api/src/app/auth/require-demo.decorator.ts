// -----------------------------------------------------------------------------
// @RequireDemo(demoId) — anota un endpoint para que el DemoAccessGuard
// rechace requests cuyo tenant no tiene ese demo habilitado.
//
// Uso:
//   @RequireDemo('tutor')
//   @Sse()
//   tutor(@Query() q: TutorQueryDto, @CurrentTenant() tenantId: string) {
//     ...
//   }
//
// Soporta dos modos:
//   1) demoId estático — `@RequireDemo('rag')` para endpoints que sirven
//      siempre el mismo demo (ej. POST /api/v1/tutor).
//   2) demoId dinámico — `@RequireDemo({ from: 'query', key: 'demoId' })`
//      para endpoints que reciben el demoId en el query string (ej. GET
//      /api/v1/chat?demoId=rag).
//
// El guard lee la metadata, extrae el demoId final y consulta a
// IndustryService.hasDemo. Si no calza, 403 con mensaje claro.
// -----------------------------------------------------------------------------

import { SetMetadata } from '@nestjs/common';

/** Key bajo la cual se guarda la metadata. Lo lee el guard con Reflector. */
export const REQUIRE_DEMO_KEY = 'requireDemo';

/**
 * Especificación de qué demo se requiere para que la request pase. Dos
 * formas: fija (string) o dinámica (extraído del request).
 */
export type RequireDemoSpec = string | { from: 'query' | 'body'; key: string };

/**
 * Decorator que adjunta la spec a los metadatos del handler O de la clase.
 * NO valida — eso es trabajo del DemoAccessGuard.
 *
 * Aplicado a nivel de clase: afecta todos los handlers del controller.
 *   @Controller('compare')
 *   @RequireDemo('comparator')
 *   class CompareController { ... }
 *
 * Aplicado a nivel de método: afecta solo ese handler.
 *   @Sse()
 *   @RequireDemo({ from: 'query', key: 'demoId' })
 *   chat(@Query() q: ChatDto) { ... }
 *
 * `SetMetadata` de NestJS ya devuelve el tipo unión `CustomDecorator` que
 * funciona en ambas posiciones — el cast a `ClassDecorator & MethodDecorator`
 * hace explícito al compiler que esto es válido en las dos.
 */
export const RequireDemo = (
  spec: RequireDemoSpec,
): ClassDecorator & MethodDecorator =>
  SetMetadata(REQUIRE_DEMO_KEY, spec) as ClassDecorator & MethodDecorator;
