// -----------------------------------------------------------------------------
// InternalKeyGuard — autenticación simple por shared secret para producción.
//
// Por qué existe:
//   En deploy a Railway, el backend queda en una URL pública (ej.
//   `*.up.railway.app`). Sin protección, cualquiera con la URL puede llamar
//   los endpoints — y como esos endpoints llaman al LLM real, eso quemaría
//   las keys de Anthropic/OpenAI.
//
//   El frontend en Vercel no llama al backend directo desde el browser. Hay
//   una Route Handler de Next.js (`apps/web/src/app/api/[...path]/route.ts`)
//   que actúa de proxy server-side e inyecta el header `X-Internal-Key`. Ese
//   secreto NUNCA llega al browser — vive solo en las env vars de Vercel.
//
// Cómo funciona:
//   - Si `INTERNAL_API_KEY` está vacío en el entorno → guard inactivo.
//     Eso permite que `nx serve api` en local funcione sin configurar nada.
//   - Si está seteado, todas las rutas exigen el header `X-Internal-Key` con
//     el mismo valor. Excepción: `/api/v1/health` queda abierto para que
//     Railway pueda hacer healthchecks sin compartir el secreto.
//
// Por qué guard global y no decoradores por controller:
//   Es más seguro por default — un endpoint nuevo nace protegido. Para abrir
//   uno, hay que excepcionarlo explícitamente acá (ver HEALTH_PATH).
// -----------------------------------------------------------------------------

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

const HEADER = 'x-internal-key';

/** Rutas que NO requieren key — empareja por `req.path` (sin querystring). */
const OPEN_PATHS = new Set(['/api/v1/health']);

@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalKeyGuard.name);
  private readonly required: string;
  private readonly active: boolean;

  constructor() {
    this.required = process.env.INTERNAL_API_KEY ?? '';
    this.active = this.required.length > 0;

    if (!this.active) {
      this.logger.warn(
        'INTERNAL_API_KEY vacía — guard inactivo (OK en dev/local, peligroso en prod).',
      );
    } else {
      this.logger.log('Guard activo: todas las rutas exigen X-Internal-Key.');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.active) return true;

    const req = context.switchToHttp().getRequest<Request>();

    if (OPEN_PATHS.has(req.path)) return true;

    const got = req.headers[HEADER];
    if (typeof got !== 'string' || got !== this.required) {
      throw new UnauthorizedException('Invalid or missing internal key.');
    }
    return true;
  }
}
