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

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // `getOrThrow` para JWT_SECRET — el env.schema ya valida que exista
      // y tenga ≥ 32 chars, pero TypeScript no lo deduce. Esta llamada hace
      // explícito que la falta del secret es un fatal en tiempo de boot.
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d',
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
