// -----------------------------------------------------------------------------
// Middleware de Next.js — dos responsabilidades en orden:
//
//   1) Basic auth opcional (HTTP Basic). Protege el deploy público antes que
//      cualquier otra lógica. Si BASIC_AUTH_USER/PASSWORD no están seteadas,
//      este paso queda inactivo y se pasa al siguiente.
//
//   2) Auth de aplicación (cookie `auth` con JWT). Si la ruta no es pública
//      y la cookie no está presente, redirige a /login con ?from=<ruta>
//      para que tras loguearse el usuario vuelva a donde quería ir.
//
// Por qué el middleware solo chequea PRESENCIA de la cookie, no validez:
//   El JWT se firma con HS256 y el secreto vive en el backend. El middleware
//   corre en el edge runtime de Next y NO puede importar jsonwebtoken (no es
//   Web Standard). Hacer la verificación con Web Crypto + jose es posible pero
//   agrega complejidad y duplicación del secreto. El backend (AuthGuard) sí
//   valida cada request — si la cookie es trucha, el primer fetch protegido
//   responde 401 y el AuthProvider client-side limpia y redirige.
//
//   Trade-off: una cookie expirada o trucha NO se detecta al navegar
//   directamente a /demo/rag — la página carga, los fetches dan 401, el
//   AuthProvider redirige. Es un flash de medio segundo. Aceptable para una
//   plataforma demo; si en producción hace falta UX más fina, se evalúa
//   verificar con jose en el middleware.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// 1) Basic auth — protección del deploy
// ---------------------------------------------------------------------------

const USER = process.env.BASIC_AUTH_USER ?? '';
const PASS = process.env.BASIC_AUTH_PASSWORD ?? '';
const BASIC_AUTH_ACTIVE = USER.length > 0 && PASS.length > 0;

function checkBasicAuth(req: NextRequest): NextResponse | null {
  if (!BASIC_AUTH_ACTIVE) return null;

  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Basic ')) {
    const encoded = auth.slice('Basic '.length).trim();
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      // base64 malformado → tratamos como auth fallida.
    }
    const colonIdx = decoded.indexOf(':');
    if (colonIdx >= 0) {
      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1);
      if (user === USER && pass === PASS) {
        return null; // pasa al siguiente paso
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

// ---------------------------------------------------------------------------
// 2) Auth de aplicación — cookie auth + redirect a /login
// ---------------------------------------------------------------------------

/**
 * Rutas que NO requieren login. /login es obvio; /api/v1/auth/* es necesario
 * para que el endpoint de login funcione antes de tener cookie. /api/v1/health
 * se usa por health checks externos (Railway, Vercel).
 */
const PUBLIC_PATH_PREFIXES = ['/login', '/api/v1/auth/', '/api/v1/health'];

/** Recursos estáticos / internos de Next que no se chequean. */
const SYSTEM_PATH_PREFIXES = ['/_next/', '/favicon.ico', '/brand/', '/fonts/'];

function isPublicPath(pathname: string): boolean {
  if (SYSTEM_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

function checkAppAuth(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;
  if (isPublicPath(pathname)) return null;

  // Solo presencia. La validación es trabajo del backend.
  const hasAuthCookie = req.cookies.has('auth');
  if (hasAuthCookie) return null;

  // Redirect a /login. ?from preserva la ruta original para que el login
  // pueda redirigir de vuelta tras autenticarse.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  // Guardamos solo el path + query (no el dominio) — `from` es relativo.
  loginUrl.searchParams.set('from', pathname + req.nextUrl.search);
  // Limpiamos otros query params del original — no aplican en /login.
  for (const key of Array.from(loginUrl.searchParams.keys())) {
    if (key !== 'from') loginUrl.searchParams.delete(key);
  }

  return NextResponse.redirect(loginUrl);
}

// ---------------------------------------------------------------------------
// Entry point — corre los dos checks en orden
// ---------------------------------------------------------------------------

export function middleware(req: NextRequest): NextResponse {
  const basicAuthReject = checkBasicAuth(req);
  if (basicAuthReject) return basicAuthReject;

  const appAuthRedirect = checkAppAuth(req);
  if (appAuthRedirect) return appAuthRedirect;

  return NextResponse.next();
}

/**
 * Aplica el middleware a TODAS las rutas excepto:
 *   - _next/static / _next/image (assets internos de Next)
 *   - favicon, brand, fonts (assets públicos cuyo bloqueo molesta más de lo
 *     que protege — son archivos estáticos sin sensibilidad).
 *
 * Importante: incluimos `/api/...` adentro de la protección. Sin auth, el
 * proxy del Route Handler quedaría accesible y derrotaría el propósito.
 * Los paths PUBLIC_PATH_PREFIXES se exceptúan dentro del checkAppAuth().
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)'],
};
