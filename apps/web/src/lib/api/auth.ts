// -----------------------------------------------------------------------------
// auth.ts — funciones HTTP del módulo de autenticación.
//
// Mismo patrón que demos.ts / documents.ts del cliente: funciones puras, sin
// estado, errores como ApiError tipado. El hook useAuth() (auth-context.tsx)
// las consume; los components no las llaman directo.
//
// Sobre cookies: el AuthGuard del backend lee la cookie `auth` (httpOnly,
// SameSite=Strict). El proxy de Next.js (apps/web/src/app/api/[...path])
// reenvía la cookie del browser al backend sin tocarla, y devuelve el
// Set-Cookie del backend al browser. Por eso no hay manejo manual de
// tokens en este archivo — todo lo maneja el browser via cookies.
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import type { AuthResponse, LoginRequest, MeDemosResponse } from './types-auth';

/**
 * POST /api/v1/auth/login
 *
 * Envía credenciales al backend. Si son válidas, el backend responde 200
 * con el AuthResponse y setea la cookie `auth` con SameSite=Strict. A
 * partir de ese momento todas las requests del browser llevan la cookie
 * automáticamente.
 *
 * `credentials: 'include'` no es estrictamente necesario en same-origin
 * (el proxy y la UI viven en el mismo dominio), pero lo dejamos explícito
 * para que sea obvio el ciclo de la cookie.
 */
export async function login(
  body: LoginRequest,
  signal?: AbortSignal,
): Promise<AuthResponse> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as AuthResponse;
}

/**
 * POST /api/v1/auth/logout
 *
 * El backend borra la cookie `auth` (Set-Cookie: auth=; Max-Age=0). El
 * browser ya no la envía en próximas requests, y el AuthGuard responde 401.
 */
export async function logout(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
}

/**
 * GET /api/v1/auth/me
 *
 * Devuelve el AuthResponse del usuario logueado. 401 si la cookie no es
 * válida o no llegó. Lo usamos en el AuthProvider al montar la app para
 * saber si hay sesión activa.
 */
export async function getMe(signal?: AbortSignal): Promise<AuthResponse> {
  const response = await fetch('/api/v1/auth/me', {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as AuthResponse;
}

/**
 * GET /api/v1/me/demos
 *
 * Devuelve la cartelera resuelta del tenant del usuario logueado (PR-MT3):
 * lista final de demos con metadata completa + info de tenant e industry +
 * flag overridden.
 */
export async function getMyDemos(
  signal?: AbortSignal,
): Promise<MeDemosResponse> {
  const response = await fetch('/api/v1/me/demos', {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as MeDemosResponse;
}
