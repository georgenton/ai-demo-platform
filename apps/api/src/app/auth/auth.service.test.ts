// -----------------------------------------------------------------------------
// Tests del AuthService.
//
// Estrategia: mockeamos prisma + bcrypt para que los tests sean rápidos y
// determinísticos. NO tocan DB real ni hacen hashing real (bcrypt cost 12
// tarda ~250ms por operación — too slow para una suite).
//
// Cubrimos:
//   - login feliz: payload correcto + auth response sin password.
//   - login con email inexistente: 401 con mensaje genérico.
//   - login con contraseña incorrecta: 401 con mismo mensaje.
//   - signToken / verifyToken: round-trip.
//   - findUserById: hit y miss.
// -----------------------------------------------------------------------------

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service.js';
import type { JwtPayload } from './auth.types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user_1',
  email: 'admin@cliente.com',
  passwordHash: '$2a$12$mock-hash-here',
  displayName: 'Admin Demo',
  role: 'admin' as const,
  tenantId: 'tenant_1',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  tenant: {
    id: 'tenant_1',
    slug: 'cliente',
    displayName: 'Cliente Demo',
    industryId: 'ind_1',
    enabledDemos: ['rag'],
    branding: { accentColor: '#43C194' },
    status: 'active' as const,
    createdAt: new Date('2026-01-01'),
    industry: {
      id: 'ind_1',
      slug: 'universidad',
      displayName: 'Educación superior',
      enabledDemos: ['rag', 'comparator', 'corpus', 'agent', 'tutor'],
      defaultConfig: {},
      createdAt: new Date('2026-01-01'),
    },
  },
};

vi.mock('@org/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));

import bcrypt from 'bcryptjs';
import { prisma } from '@org/db';

describe('AuthService.login', () => {
  let service: AuthService;
  let jwt: JwtService;

  beforeEach(() => {
    jwt = new JwtService({ secret: 'test-secret-32-chars-minimum-x' });
    service = new AuthService(jwt);
    vi.clearAllMocks();
  });

  it('login feliz: devuelve payload + auth con tenant resuelto', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const { payload, auth } = await service.login(
      'admin@cliente.com',
      'plaintext',
    );

    expect(payload).toEqual({
      sub: 'user_1',
      tid: 'tenant_1',
      role: 'admin',
      email: 'admin@cliente.com',
    });
    expect(auth.user.id).toBe('user_1');
    expect(auth.tenant.slug).toBe('cliente');
    // El tenant SÍ tiene enabledDemos propios → no hereda de la industry.
    expect(auth.tenant.enabledDemos).toEqual(['rag']);
    // Password NO debe aparecer en la respuesta.
    expect(JSON.stringify(auth)).not.toContain('passwordHash');
    expect(JSON.stringify(auth)).not.toContain('hash');
  });

  it('hereda enabledDemos de la industry cuando el tenant tiene array vacío', async () => {
    const userWithInheritedDemos = {
      ...mockUser,
      tenant: { ...mockUser.tenant, enabledDemos: [] },
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
      userWithInheritedDemos as never,
    );
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const { auth } = await service.login('admin@cliente.com', 'plaintext');

    expect(auth.tenant.enabledDemos).toEqual([
      'rag',
      'comparator',
      'corpus',
      'agent',
      'tutor',
    ]);
  });

  it('email inexistente → UnauthorizedException sin filtrar info', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(
      service.login('inexistente@cliente.com', 'plaintext'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('contraseña incorrecta → UnauthorizedException con el mismo mensaje', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    await expect(
      service.login('admin@cliente.com', 'wrong-pwd'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('normaliza email a lowercase antes de consultar', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    await service.login('ADMIN@Cliente.COM', 'plaintext');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@cliente.com' },
      include: { tenant: { include: { industry: true } } },
    });
  });
});

describe('AuthService.signToken / verifyToken', () => {
  it('round-trip con el mismo secret', () => {
    const jwt = new JwtService({
      secret: 'test-secret-32-chars-minimum-xxx',
      signOptions: { expiresIn: '1h' },
    });
    const service = new AuthService(jwt);
    const payload: JwtPayload = {
      sub: 'user_1',
      tid: 'tenant_1',
      role: 'admin',
      email: 'admin@cliente.com',
    };
    const token = service.signToken(payload);
    expect(typeof token).toBe('string');

    const decoded = service.verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.tid).toBe(payload.tid);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.email).toBe(payload.email);
  });
});

describe('AuthService.findUserById', () => {
  it('devuelve AuthResponse cuando el user existe', async () => {
    const service = new AuthService(new JwtService({ secret: 'x'.repeat(32) }));
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never);

    const result = await service.findUserById('user_1');

    expect(result?.user.id).toBe('user_1');
    expect(result?.tenant.slug).toBe('cliente');
  });

  it('devuelve null si el user no existe', async () => {
    const service = new AuthService(new JwtService({ secret: 'x'.repeat(32) }));
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    expect(await service.findUserById('inexistente')).toBeNull();
  });
});
