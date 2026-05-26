// -----------------------------------------------------------------------------
// AllExceptionsFilter — global exception handler para el backend.
//
// Por qué lo necesitamos:
//   - Sin filter, NestJS imprime el stack trace y devuelve un body genérico.
//     Eso (a) leak de info interna al cliente, y (b) UX pobre — el frontend
//     no puede mostrar un mensaje útil.
//   - Con filter, cada error que no manejó un controller pasa por acá y se
//     normaliza a una forma consistente:
//       { statusCode, message, error?, path, timestamp }
//   - Los errores 5xx se loguean con stack del lado del server (para
//     debug); 4xx no (son esperados, no contaminan logs).
//
// HttpException (lo que lanza NotFoundException, BadRequestException, etc.)
// se pasa tal cual con su status original. Cualquier otro Error (TypeError,
// etc.) se convierte en 500.
// -----------------------------------------------------------------------------

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message, error } = this.normalize(exception);

    const body: ErrorResponseBody = {
      statusCode,
      message,
      ...(error ? { error } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // 5xx → loguear con stack para debug del operador.
    // 4xx → solo log breve (esperado, no es ruido valioso).
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}: ${this.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${statusCode}: ${this.stringify(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  /**
   * Convierte cualquier excepción a la forma `{ statusCode, message, error }`.
   * HttpException ya tiene esto casi listo; otros Error son 500 genéricos.
   */
  private normalize(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error?: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { statusCode: status, message: res };
      }
      // NestJS responses suelen tener forma { statusCode, message, error }.
      const obj = res as { message?: string | string[]; error?: string };
      return {
        statusCode: status,
        message: obj.message ?? exception.message,
        error: obj.error,
      };
    }

    // Error genérico: 500. NO leak del stack al cliente — eso queda en logs.
    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: message, // mensaje del Error original, no el stack
    };
  }

  private stringify(value: unknown): string {
    return Array.isArray(value) ? value.join('; ') : String(value);
  }
}
