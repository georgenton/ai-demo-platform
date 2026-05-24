/**
 * Bootstrap del backend NestJS.
 *
 * Globales que se configuran acá (afectan a todos los controllers):
 *   - prefix `api` → todas las rutas viven bajo /api/...
 *   - versionado por URI → /api/v1/... (defaultVersion = '1')
 *   - ValidationPipe → valida los DTOs con class-validator en el borde.
 */

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
