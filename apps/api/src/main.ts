/**
 * Bootstrap del backend NestJS.
 *
 * Globales que se configuran acá (afectan a todos los controllers):
 *   - prefix `api` → todas las rutas viven bajo /api/...
 *   - versionado por URI → /api/v1/... (defaultVersion = '1')
 *   - ValidationPipe → valida los DTOs con class-validator en el borde.
 */

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app/app.module';
import { AuthGuard } from './app/auth/auth.guard.js';
import { DemoAccessGuard } from './app/auth/demo-access.guard.js';
import { RolesGuard } from './app/auth/roles.guard.js';
import { TenantGuard } from './app/auth/tenant.guard.js';
import { AllExceptionsFilter } from './app/common/all-exceptions.filter.js';
import { InternalKeyGuard } from './app/common/internal-key.guard.js';

async function bootstrap() {
  // Si las env vars son inválidas, ConfigModule (registrado en AppModule)
  // hace que esto lance acá con la lista de campos faltantes. Falla rápida.
  const app = await NestFactory.create(AppModule);

  // cookie-parser: necesario para que el AuthController lea req.cookies. Tiene
  // que registrarse antes que los routers para que las cookies estén
  // disponibles en todos los handlers (ADR-0014).
  app.use(cookieParser());

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Versionado URI: cada controller hereda v1 a menos que diga otra cosa.
  // Para sumar v2 más adelante: `@Controller({ path: '...', version: '2' })`.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validación automática de todos los DTOs (vía class-validator).
  //   - whitelist: descarta campos no declarados en el DTO.
  //   - forbidNonWhitelisted: rechaza con 400 si vienen extras.
  //   - transform: convierte el body en instancia del DTO (no plain object).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global error filter: cualquier excepción no manejada pasa por acá. Da:
  //   - shape consistente del JSON de error (statusCode/message/path/timestamp)
  //   - sin leak de stack al cliente
  //   - logging diferenciado (5xx con stack, 4xx solo warn).
  app.useGlobalFilters(new AllExceptionsFilter());

  // Auth simple por shared secret. En dev (sin INTERNAL_API_KEY) el guard
  // queda inactivo; en prod (Railway) exige el header X-Internal-Key que
  // inyecta el proxy de Next.js — ver apps/web/src/app/api/[...path]/route.ts.
  //
  // Cadena de guards globales (ADR-0013, ADR-0014, PR-MT3/MT5):
  //   1) InternalKeyGuard — X-Internal-Key (solo activo en prod).
  //   2) AuthGuard        — JWT en cookie obligatorio (excepto @Public()).
  //   3) TenantGuard      — pone request.tenantId desde el JWT.
  //   4) DemoAccessGuard  — si el handler declara @RequireDemo(), valida
  //                         que el tenant tenga ese demo habilitado.
  //   5) RolesGuard       — si el handler declara @RequireRole(), valida
  //                         que el rol del usuario sea >= al requerido.
  //
  // El orden importa: cada guard depende de que el anterior haya corrido.
  //
  // Los obtenemos del container para que NestJS resuelva sus dependencias
  // (Reflector, AuthService, IndustryService). InternalKeyGuard se construye
  // a mano, pero recibe Reflector para respetar @Public().
  const reflector = app.get(Reflector);
  const authGuard = app.get(AuthGuard);
  const tenantGuard = app.get(TenantGuard);
  const demoAccessGuard = app.get(DemoAccessGuard);
  const rolesGuard = app.get(RolesGuard);
  app.useGlobalGuards(
    new InternalKeyGuard(reflector),
    authGuard,
    tenantGuard,
    demoAccessGuard,
    rolesGuard,
  );

  // CORS: en prod el frontend NO llama al backend desde el browser — todo va
  // server-side por el proxy de Next. CORS no es la línea de defensa (lo es
  // el InternalKeyGuard). Lo habilitamos abierto para que un curl o un test
  // E2E externo puedan pegar al backend con la key correcta sin friction.
  app.enableCors({ origin: true, credentials: false });

  // OpenAPI / Swagger UI. La spec se genera a partir de:
  //   - decoradores @ApiTags/@ApiOperation/@ApiResponse en controllers
  //   - decoradores @ApiProperty en DTOs (class-validator + class-transformer
  //     ya están — sumamos los de @nestjs/swagger encima)
  //
  // Se sirve en:
  //   GET /api/docs       → UI interactiva (Swagger UI)
  //   GET /api/docs-json  → spec JSON cruda (para clientes generadores)
  //
  // Sin auth: estamos en dev/demo; cuando vaya a prod con cliente real, lo
  // ponemos detrás de basic-auth o lo deshabilitamos en producción.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Demo Platform API')
    .setDescription(
      'Backend de la plataforma de demos sobre Nutanix Enterprise AI. ' +
        'Ingest de documentos, chat RAG (Demo 01), comparador (Demo 02) y ' +
        'agente NL→SQL (Demo 04). Streaming SSE en chat/compare/agent.',
    )
    .setVersion('1.0.0')
    .addServer(`/${globalPrefix}/v1`, 'Default (v1)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    jsonDocumentUrl: `${globalPrefix}/docs-json`,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    `📖 OpenAPI docs:               http://localhost:${port}/${globalPrefix}/docs`,
  );
}

bootstrap();
