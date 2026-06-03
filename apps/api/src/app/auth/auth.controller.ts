// -----------------------------------------------------------------------------
// AuthController — los tres endpoints públicos del módulo Auth.
//
// POST   /api/v1/auth/login   — valida credenciales, setea cookie JWT.
// POST   /api/v1/auth/logout  — limpia la cookie. Idempotente.
// GET    /api/v1/auth/me      — devuelve el user logueado o 401.
//
// El AuthGuard global se SALTA estos endpoints (decorator @Public). Sólo
// `/auth/me` requiere el JWT — se lo lee directamente de la cookie sin
// pasar por el guard (más simple que cambiar la lógica del guard).
// -----------------------------------------------------------------------------

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import type { AuthResponse } from './auth.types.js';
import { Public } from './public.decorator.js';

const COOKIE_NAME = 'auth';

@ApiTags('Auth')
@Controller({ path: 'auth' })
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login con email + contraseña',
    description:
      'Valida credenciales. Si son correctas, setea una cookie httpOnly + Secure + SameSite=Strict con el JWT firmado y devuelve datos del user y su tenant. Si fallan, 401 sin distinguir entre "email no existe" y "contraseña incorrecta".',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { payload, auth } = await this.authService.login(
      dto.email,
      dto.password,
    );
    const token = this.authService.signToken(payload);

    res.cookie(COOKIE_NAME, token, this.cookieOptions());
    return auth;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Limpia la cookie de auth. Idempotente — siempre 200.',
  })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(COOKIE_NAME, this.cookieOptions());
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({
    summary: 'User logueado actual',
    description:
      'Devuelve los datos del user a partir del JWT en la cookie. 401 si la cookie no existe o está vencida.',
  })
  async me(@Req() req: Request): Promise<AuthResponse> {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      COOKIE_NAME
    ];
    if (!token) {
      throw new UnauthorizedException('No hay sesión activa.');
    }
    let payload;
    try {
      payload = this.authService.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida.');
    }
    const auth = await this.authService.findUserById(payload.sub);
    if (!auth) {
      // User existía cuando se emitió el token pero fue borrado.
      throw new UnauthorizedException('Cuenta no encontrada.');
    }
    return auth;
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Opciones de cookie según entorno. En producción/staging (HTTPS) la
   * cookie va con Secure=true; en local con http, false. SameSite siempre
   * 'strict' porque el frontend es la misma origin (proxy via Next.js
   * rewrites). El maxAge espeja el JWT_EXPIRES_IN para que el browser
   * tire la cookie cuando el token vence.
   */
  private cookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '7d';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict' as const,
      maxAge: parseDurationMs(expiresIn),
      ...(domain ? { domain } : {}),
      path: '/',
    };
  }
}

/**
 * Parseo mínimo de duraciones tipo '7d', '12h', '30m'. No usamos `ms` para
 * evitar otra dependencia. Si la string es inválida, devolvemos 7 días.
 */
function parseDurationMs(s: string): number {
  const match = /^(\d+)([smhd])$/i.exec(s.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60_000
        : unit === 'h'
          ? 3_600_000
          : 86_400_000;
  return n * factor;
}
