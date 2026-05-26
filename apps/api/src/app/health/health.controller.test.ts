// Tests del HealthController.
//
// Mock de `prisma.$queryRaw`:
//   - Happy: devuelve [{}] → check.ok === true, status='ok'.
//   - DB caída: rechaza con Error → lanza ServiceUnavailableException con el
//     payload de respuesta dentro (los monitorings leen el body).

import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('@org/db', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    mockQueryRaw.mockReset();
    controller = new HealthController();
  });

  it('devuelve status=ok con uptime y timestamp cuando la DB responde', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.checks.db.ok).toBe(true);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    // ISO-8601 simple check
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('lanza ServiceUnavailableException (503) cuando la DB falla', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
    // El body del 503 lleva el detalle de qué falló (útil para monitorings).
    await expect(controller.check()).rejects.toMatchObject({
      response: {
        status: 'error',
        checks: { db: { ok: false, error: 'connection refused' } },
      },
    });
  });
});
