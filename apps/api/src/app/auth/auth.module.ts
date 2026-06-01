// -----------------------------------------------------------------------------
// AuthModule — registra el JwtModule, el service y el controller.
//
// El JwtModule se configura async con ConfigService para leer JWT_SECRET y
// JWT_EXPIRES_IN del env validado (ver env.schema.ts). Si JWT_SECRET no
// está presente, la app ni siquiera arranca — el env-schema lo exige.
//
// Ver ADR-0014.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

import { IndustryModule } from '../industries/industry.module.js';

import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { DemoAccessGuard } from './demo-access.guard.js';
import { RolesGuard } from './roles.guard.js';
import { TenantGuard } from './tenant.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // `getOrThrow` para JWT_SECRET — el env.schema ya valida que exista
      // y tenga ≥ 32 chars, pero TypeScript no lo deduce. Esta llamada hace
      // explícito que la falta del secret es un fatal en tiempo de boot.
      useFactory: (config: ConfigService): JwtModuleOptions => {
        // `expiresIn` espera el tipo StringValue de `ms` (literal '7d',
        // '12h', etc.). El env-schema valida que sea string, pero TS no
        // puede inferir los template literal types de `ms` desde un string
        // dinámico — castamos explícito al tipo aceptado por SignOptions.
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          '7d') as SignOptions['expiresIn'];
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn,
            algorithm: 'HS256',
          },
        };
      },
    }),
    // IndustryModule: el DemoAccessGuard consume IndustryService para
    // resolver enabledDemos del tenant.
    IndustryModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, TenantGuard, DemoAccessGuard, RolesGuard],
  exports: [
    AuthService,
    AuthGuard,
    TenantGuard,
    DemoAccessGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
