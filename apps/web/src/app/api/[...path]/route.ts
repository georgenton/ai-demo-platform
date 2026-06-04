// -----------------------------------------------------------------------------
// Proxy server-side al backend NestJS.
//
// Por qué este Route Handler reemplaza los `rewrites()` que teníamos en
// next.config.js:
//   - Los rewrites de Next NO permiten inyectar headers en el destino. Para
//     proteger el backend en producción con `X-Internal-Key`, el secreto
//     tiene que vivir en el server-side del frontend (Vercel env vars) y
//     NUNCA llegar al browser. Un Route Handler corre en Vercel Functions
//     server-side — el cliente nunca ve el header ni su valor.
//
//   - Bonus: este proxy también funciona en dev. `BACKEND_URL` apunta a
//     `http://localhost:3000` por default; si no tienes `INTERNAL_API_KEY`
//     configurada, el header simplemente no se inyecta y el backend lo
//     ignora (guard inactivo, ver internal-key.guard.ts).
//
// Tipos de tráfico que el proxy soporta:
//   - GET con SSE (chat RAG via EventSource)
//   - POST JSON con SSE response (Compare, Agent vía fetch + stream reader)
//   - POST multipart/form-data (upload PDF al ingest)
//   - GET/POST/DELETE normales (CRUD de documentos, demos catalog, etc.)
//
// Implementación: pasamos el body como ReadableStream sin parsearlo —
// soporta JSON, multipart y SSE indistintamente. La opción `duplex: 'half'`
// es obligatoria en Node 18+ cuando el `body` es un stream.
// -----------------------------------------------------------------------------

import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? '';

/**
 * Headers que NO reenviamos al upstream:
 *   - host: lo regenera fetch con la URL del backend.
 *   - connection / content-length: managed por undici al hacer fetch.
 *   - x-forwarded-*: confunden si el backend los lee como propios.
 */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
]);

/** Métodos que pueden llevar body. */
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Headers de la response upstream que NO debemos reenviar al cliente.
 *
 * El crítico es `content-encoding`: cuando Node's `fetch` (undici) recibe
 * una respuesta con `Content-Encoding: gzip/br/deflate`, **descomprime el
 * body automáticamente** antes de exponerlo como ReadableStream. Si dejamos
 * el header `content-encoding: gzip` en la respuesta que mandamos al cliente,
 * el browser intentará descomprimir un body que ya es texto plano y tirará
 * `ERR_CONTENT_DECODING_FAILED 200 (OK)`.
 *
 * El bug se manifestaba en producción (donde Railway comprime las respuestas
 * del backend) pero NO en dev (donde el backend NestJS sin compression middleware
 * no setea el header). El curl manual con `Accept-Encoding: identity` tampoco
 * lo reproducía, por eso fue invisible hasta que el browser lo pidió.
 *
 * También quitamos `content-length` porque cambia con la decompression y el
 * runtime lo recalcula igual; y los hop-by-hop estándar que no tiene sentido
 * propagar.
 */
const RESPONSE_HOP_BY_HOP = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

async function proxy(req: NextRequest, segments: string[]): Promise<Response> {
  const pathname = segments.join('/');
  const url = new URL(req.url);
  const target = `${BACKEND_URL}/api/${pathname}${url.search}`;

  // Filtramos los headers del cliente, reenviamos los útiles, inyectamos
  // X-Internal-Key. Pasamos el Cookie si vino — algún endpoint futuro puede
  // usarlo y no queremos romperlo silenciosamente.
  const upstreamHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    upstreamHeaders.set(key, value);
  });
  if (INTERNAL_KEY) {
    upstreamHeaders.set('X-Internal-Key', INTERNAL_KEY);
  }

  // Para métodos con body, lo pasamos como stream. `duplex: 'half'` es
  // obligatorio en Node 18+ — sin esto, fetch tira "duplex required".
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: upstreamHeaders,
    body: METHODS_WITH_BODY.has(req.method) ? req.body : undefined,
    duplex: METHODS_WITH_BODY.has(req.method) ? 'half' : undefined,
    // No queremos que fetch cachee respuestas del backend a nivel runtime —
    // el backend ya decide sus propios cache-control.
    cache: 'no-store',
    redirect: 'manual',
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    // Errores de red (backend caído, DNS fallido). Devolvemos 502 con un
    // mensaje breve — el frontend ya tiene UX para mostrar "Failed to fetch".
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Upstream unreachable', message }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  // Filtramos los headers de la response — específicamente quitamos
  // `content-encoding` porque undici ya descomprimió el body. Ver la nota
  // larga en RESPONSE_HOP_BY_HOP.
  const cleanHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_HOP_BY_HOP.has(key.toLowerCase())) return;
    cleanHeaders.set(key, value);
  });

  // Devolvemos la respuesta como stream — Next la pasa directo al cliente.
  // Para SSE (Content-Type: text/event-stream) esto preserva el streaming
  // token a token sin buffering.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: cleanHeaders,
  });
}

// Next 16 nos da `params` como Promise — hay que await. Misma signature para
// todos los métodos; delegan al helper común.
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
