// -----------------------------------------------------------------------------
// Middleware de Next.js — gating de rutas según presencia de cookie auth.
//
// Si la ruta no es pública y la cookie `auth` no está presente, redirige a
// /login con ?from=<ruta> para que tras loguearse el usuario vuelva a donde
// quería ir.
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
//
// Histórico: antes de tener auth de aplicación (pre sprint MT), el middleware
// también hacía HTTP Basic Auth a nivel deploy con BASIC_AUTH_USER y
// BASIC_AUTH_PASSWORD. Esa capa se retiró cuando llegó el login con JWT —
// duplicaba la fricción para el usuario sin agregar protección real. Las
// env vars BASIC_AUTH_USER/PASSWORD en Vercel/Railway pueden borrarse.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from 'next/server';

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

export function middleware(req: NextRequest): NextResponse {
  const pathname = req.nextUrl.pathname;
  if (isPublicPath(pathname)) return NextResponse.next();

  // Solo presencia. La validación es trabajo del backend.
  const hasAuthCookie = req.cookies.has('auth');
  if (hasAuthCookie) return NextResponse.next();

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

/**
 * Aplica el middleware a TODAS las rutas excepto:
 *   - _next/static / _next/image (assets internos de Next)
 *   - favicon, brand, fonts (assets públicos cuyo bloqueo molesta más de lo
 *     que protege — son archivos estáticos sin sensibilidad).
 *
 * Importante: incluimos `/api/...` adentro de la protección. Sin auth, el
 * proxy del Route Handler quedaría accesible y derrotaría el propósito.
 * Los paths PUBLIC_PATH_PREFIXES se exceptúan dentro del propio middleware.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)'],
};
