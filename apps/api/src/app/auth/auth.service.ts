// -----------------------------------------------------------------------------
// AuthService — lógica de autenticación.
//
// Responsabilidades:
//   - Verificar email + contraseña contra el hash bcrypt almacenado.
//   - Emitir JWT con el payload estándar (sub, tid, role, email).
//   - Actualizar `lastLoginAt` para auditoría.
//   - Buscar al user por id (lo usa GET /auth/me).
//
// El controller maneja cookies y errores HTTP; el service solo conoce DB
// y crypto. Esa separación facilita testear con mocks.
//
// Ver ADR-0014 para la decisión de fondo.
// -----------------------------------------------------------------------------

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma, type User, type Tenant, type Industry } from '@org/db';
import bcrypt from 'bcryptjs';

import type { AuthResponse, JwtPayload } from './auth.types.js';

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwt: JwtService) {}

  /**
   * Valida credenciales y devuelve el payload listo para firmar + la
   * AuthResponse para el body. Lanza 401 si email no existe o contraseña
   * no coincide — sin distinguir entre los dos casos para no filtrar
   * existencia de cuentas.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ payload: JwtPayload; auth: AuthResponse }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: { include: { industry: true } } },
    });

    if (!user) {
      // Mensaje genérico — no decimos "email no existe" para no filtrar
      // cuentas válidas a un atacante.
      throw new UnauthorizedException('Email o contraseña incorrectos.');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.logger.warn(`Login fallido para ${email}`);
      throw new UnauthorizedException('Email o contraseña incorrectos.');
    }

    // Actualizamos lastLoginAt sin esperar (fire-and-forget). Si la
    // escritura falla, no debería abortar el login — la auditoría es
    // best-effort.
    void prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err) =>
        this.logger.warn(`No se pudo actualizar lastLoginAt: ${err.message}`),
      );

    const payload: JwtPayload = {
      sub: user.id,
      tid: user.tenantId,
      role: user.role,
      email: user.email,
    };

    return { payload, auth: this.toAuthResponse(user) };
  }

  /**
   * Firma el payload con el JWT_SECRET. Configurado en AuthModule para
   * usar HS256 con expiración del env (default 7d).
   */
  signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }

  /**
   * Verifica un token y devuelve el payload. Lanza si está vencido o
   * firmado con otro secret.
   */
  verifyToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }

  /**
   * Lookup del user por id. Se usa en GET /auth/me para devolver datos
   * actualizados aunque el JWT lleve datos viejos (ej. cambio de rol).
   */
  async findUserById(userId: string): Promise<AuthResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { include: { industry: true } } },
    });
    if (!user) return null;
    return this.toAuthResponse(user);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Convierte el modelo Prisma + relaciones cargadas en la forma pública
   * de AuthResponse. NUNCA incluye passwordHash.
   */
  private toAuthResponse(
    user: User & { tenant: Tenant & { industry: Industry } },
  ): AuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        displayName: user.tenant.displayName,
        // industry nested — el frontend (UserMenu, Header) lee
        // tenant.industry.displayName. Si solo devolvemos industrySlug
        // (string plano), el frontend hace .industry.displayName sobre
        // undefined y crashea. Ver bug del UserMenu reportado por Jorge
        // en producción tras el deploy del sprint MT.
        industry: {
          slug: user.tenant.industry.slug,
          displayName: user.tenant.industry.displayName,
        },
        // industrySlug se mantiene por compat con consumers viejos que
        // pudieran existir (deprecado — preferir industry.slug).
        industrySlug: user.tenant.industry.slug,
        // enabledDemos del tenant sobreescribe el de la industry si no está
        // vacío; si está vacío, hereda.
        enabledDemos:
          user.tenant.enabledDemos.length > 0
            ? user.tenant.enabledDemos
            : user.tenant.industry.enabledDemos,
        branding: user.tenant.branding as Record<string, unknown>,
        status: user.tenant.status,
      },
    };
  }

  /**
   * Hashea una contraseña en texto plano con bcrypt cost 12. Exposed para
   * el seed y para futuros endpoints de cambio de contraseña.
   */
  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }
}
