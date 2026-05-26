// Tests del AllExceptionsFilter.
//
// Construimos a mano un ArgumentsHost "fake" con request/response stubbed —
// alcanza para verificar el JSON serializado, el status y el log de errores.
// El framework completo (E2E) se cubrirá en otro PR.

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

function makeHost(method = 'GET', url = '/api/v1/test') {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const response = { status, json };
  const request = { method, url };

  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => () => undefined,
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
    getType: () => 'http',
  };

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('pasa el status y mensaje de un NotFoundException tal cual', () => {
    const { host, status, json } = makeHost();
    filter.catch(new NotFoundException('doc xyz no existe'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledOnce();
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 404,
      message: 'doc xyz no existe',
      path: '/api/v1/test',
    });
    expect(body.timestamp).toMatch(/^\d{4}-/);
  });

  it('preserva el array de mensajes de un BadRequest (lo manda el ValidationPipe)', () => {
    const { host, json } = makeHost('POST');
    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['name should not be empty', 'demoId should not be empty'],
        error: 'Bad Request',
      }),
      host,
    );

    const body = json.mock.calls[0][0];
    expect(body.message).toEqual([
      'name should not be empty',
      'demoId should not be empty',
    ]);
    expect(body.error).toBe('Bad Request');
  });

  it('convierte un Error nativo (no Http) en 500 sin leakear el stack', () => {
    const { host, status, json } = makeHost();
    filter.catch(new TypeError('foo.bar is not a function'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    // El message al cliente es genérico — NO incluye 'foo.bar' al frente.
    expect(body.message).toBe('Internal server error');
    // Pero el error original queda en `error` (útil para tracking, sin stack).
    expect(body.error).toBe('foo.bar is not a function');
  });

  it('respeta el status custom de un HttpException con response string', () => {
    const { host, status } = makeHost();
    filter.catch(
      new HttpException('teapot mode', HttpStatus.I_AM_A_TEAPOT),
      host,
    );
    expect(status).toHaveBeenCalledWith(418);
  });
});
