// -----------------------------------------------------------------------------
// @CurrentUser() y @CurrentTenant() — decorators de parámetros para los
// controllers que necesitan saber quién está consultando.
//
// Uso típico:
//   @Get('documents')
//   list(@CurrentTenant() tenantId: string) {
//     return this.documentsService.list(tenantId);
//   }
//
// Los decoradores leen `request.user` (poblado por AuthGuard) y
// `request.tenantId` (poblado por TenantGuard). Si el endpoint olvida
// agregar el filtro al service, el service mismo recibe el tenantId
// como parámetro obligatorio — el contract acoda al programador.
// -----------------------------------------------------------------------------

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { isValidChatProvider } from '@org/llm-adapter';
import type { ChatProvider } from '@org/llm-adapter';
import type { Request } from 'express';

import type { JwtPayload } from './auth.types.js';

/**
 * Devuelve el JwtPayload completo: { sub, tid, role, email }. Útil cuando
 * el handler necesita validar role explícitamente o usar el email para
 * logging.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    return req.user;
  },
);

/**
 * Atajo para el caso más común: solo necesito el tenantId del request en
 * curso. Vuelve el string ya validado y posiblemente sobreescrito por
 * superadmin (ver TenantGuard).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { tenantId?: string }>();
    return req.tenantId;
  },
);

/**
 * Lee el header `X-LLM-Provider` del request y lo devuelve si es un valor
 * válido del union `ChatProvider`. Si el header no viene o trae un valor
 * desconocido, devuelve `undefined` — el caller decide qué hacer:
 *
 *   - Path típico: pasar el valor al adapter como `{ provider }`. Si es
 *     undefined, el adapter cae al singleton del env (path legacy).
 *   - Path estricto: si tu controller exige que el cliente elija
 *     explícitamente, rechaza la request con 400 cuando undefined.
 *
 * No es un guard porque es opcional por default. Si quieres exigirlo,
 * combínalo con un guard custom o una verificación en el controller.
 *
 * Uso:
 *   @Post()
 *   chat(@CurrentLlmProvider() provider: ChatProvider | undefined, ...) {
 *     return this.service.streamChat(dto, provider);
 *   }
 */
export const CurrentLlmProvider = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ChatProvider | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    // 1) Header `X-LLM-Provider` — el path normal (clients HTTP/SSE via
    //    openSseStream propagan así).
    const rawHeader = req.headers['x-llm-provider'];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof header === 'string' && isValidChatProvider(header)) {
      return header;
    }
    // 2) Query param `llmProvider` — fallback para EventSource, que NO
    //    soporta headers custom (solo el chat RAG llega así por GET).
    const query = req.query as Record<string, unknown> | undefined;
    const rawQuery = query?.llmProvider;
    const queryValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    if (typeof queryValue === 'string' && isValidChatProvider(queryValue)) {
      return queryValue;
    }
    return undefined;
  },
);
