// -----------------------------------------------------------------------------
// HealthController — endpoint estándar de salud del servicio.
//
// GET /api/v1/health
//   200 OK con { status: 'ok', uptime, checks: { db: { ok: true } } } si
//       Postgres responde.
//   503 con { status: 'error', uptime, checks: { db: { ok: false, error } } }
//       si la DB está caída.
//
// Lo usa cualquier sistema que monitoree o gatille deploys (Vercel health
// check, k8s liveness, simple curl en producción).
// -----------------------------------------------------------------------------

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { prisma } from '@org/db';

export interface HealthCheck {
  ok: boolean;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  /** Segundos desde que el proceso arrancó. */
  uptime: number;
  /** Timestamp del check en ISO-8601. Útil para correlar con logs. */
  timestamp: string;
  checks: {
    db: HealthCheck;
  };
}

@Controller({ path: 'health', version: '1' })
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  /**
   * Devuelve el estado del servicio. 200 si todo bien, 503 si algún check
   * falla — convención de Kubernetes/Vercel/Lighthouse para monitoring.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthResponse> {
    const db = await this.pingDatabase();

    const response: HealthResponse = {
      status: db.ok ? 'ok' : 'error',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { db },
    };

    if (!db.ok) {
      // 503 Service Unavailable es el código correcto para "el servicio
      // está vivo pero alguna dependencia no responde". Pasamos el body
      // como respuesta para que el monitor vea qué falló.
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  /**
   * `SELECT 1` es la query más liviana posible: sin tablas, sin parsing
   * complejo. Si la DB no responde a esto, hay un problema serio.
   */
  private async pingDatabase(): Promise<HealthCheck> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DB health check failed: ${message}`);
      return { ok: false, error: message };
    }
  }
}
