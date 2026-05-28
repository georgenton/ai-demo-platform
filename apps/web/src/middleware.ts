// -----------------------------------------------------------------------------
// Basic auth middleware — protege el deploy público de Vercel.
//
// Por qué este nivel de protección:
//   El backend en Railway usa LLM real (Anthropic + OpenAI). Sin basic auth,
//   cualquiera con la URL podría consumir las keys y vaciar la cuenta. Con
//   basic auth + `InternalKeyGuard` en el backend, el deploy queda en
//   "mostrale a quien le mando las credenciales" — suficiente para una demo
//   comercial.
//
// Cómo funciona:
//   - Si `BASIC_AUTH_USER` o `BASIC_AUTH_PASSWORD` están vacías → middleware
//     no hace nada (dev/local). El cliente entra directo.
//   - Si ambas están seteadas, pedimos `Authorization: Basic <base64>` con
//     `user:pass`. Sin él, 401 con WWW-Authenticate — el browser muestra
//     el prompt nativo.
//
// Por qué no usar Vercel Password Protection (la feature paga):
//   Es plan Pro ($20/mes). Basic auth en middleware es gratis, funciona en
//   plan Hobby, y nos da el mismo nivel de protección para una demo.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from 'next/server';

const USER = process.env.BASIC_AUTH_USER ?? '';
const PASS = process.env.BASIC_AUTH_PASSWORD ?? '';
const ACTIVE = USER.length > 0 && PASS.length > 0;

export function middleware(req: NextRequest): NextResponse {
  if (!ACTIVE) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Basic ')) {
    const encoded = auth.slice('Basic '.length).trim();
    // `atob` está disponible en el runtime de Vercel (Web Standard). Evita
    // pulling de Buffer que en algunos runtimes no existe.
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      // base64 malformado → tratamos como auth fallida.
    }
    // El password puede tener ':' adentro — split solo el primero.
    const colonIdx = decoded.indexOf(':');
    if (colonIdx >= 0) {
      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1);
      if (user === USER && pass === PASS) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ai-demo-platform", charset="UTF-8"',
    },
  });
}

/**
 * Aplica el middleware a TODAS las rutas excepto:
 *   - _next/static / _next/image (assets internos de Next)
 *   - favicon, brand, fonts (assets públicos cuyo bloqueo molesta más de lo
 *     que protege — son archivos estáticos sin sensibilidad).
 *
 * Importante: incluimos `/api/...` adentro de la protección. Sin auth, el
 * proxy del Route Handler quedaría accesible y derrotaría el propósito.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)'],
};
