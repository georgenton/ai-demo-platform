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
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
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
