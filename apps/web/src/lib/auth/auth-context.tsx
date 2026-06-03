// -----------------------------------------------------------------------------
// AuthProvider + useAuth() hook — fuente única de verdad del estado de
// sesión en el frontend.
//
// Analogía:
//   Imagina el AuthProvider como el portero del edificio. Cuando un visitante
//   (componente) llega y pregunta "¿hay alguien logueado?", el portero
//   responde con uno de cuatro estados:
//     - "loading"           — todavía revisando la credencial
//     - "unauthenticated"   — no hay nadie, vuelve a /login
//     - "authenticated"     — sí, acá están los datos
//     - "error"             — hubo un problema verificando (network down, etc.)
//
//   El portero también ofrece dos servicios: "loguear a alguien" (login) y
//   "echar al actual" (logout). Después de cada acción actualiza su estado
//   interno y notifica a los visitantes que estén suscritos.
//
// Implementación:
//   - El estado vive en useState; el provider expone {status, user, tenant,
//     login(), logout(), refresh()}.
//   - Al montar, llama getMe() — si la cookie es válida pasa a authenticated;
//     si 401 a unauthenticated. La redirección a /login NO se hace acá; eso es
//     trabajo del middleware de Next (capa server-side) y/o de un guard de
//     ruta cliente que el caller monte si quiere.
// -----------------------------------------------------------------------------

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '@/lib/api/client';
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
} from '@/lib/api/auth';
import type { AuthResponse, LoginRequest } from '@/lib/api/types-auth';

/**
 * Cuatro estados mutuamente excluyentes. `status` es el campo que los
 * componentes consultan para decidir qué pintar.
 */
export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  /** Solo poblado cuando status === 'authenticated'. */
  user: AuthResponse['user'] | null;
  /** Solo poblado cuando status === 'authenticated'. */
  tenant: AuthResponse['tenant'] | null;
  /** Mensaje de error si status === 'error'. */
  errorMessage: string | null;
  /** Lanza ApiError si el login falla; el caller decide cómo mostrarlo. */
  login: (body: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch del estado actual. Útil tras cambios de rol o branding. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook de consumo. Lanza si se usa fuera del provider — error temprano que
 * pega antes que el primer render fallado, ayuda mucho debuggeando.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuth() debe usarse dentro de <AuthProvider>. Verifica el layout root.',
    );
  }
  return ctx;
}

/**
 * Provider que monta el portero. Va arriba en el árbol (root layout).
 *
 * `initialAuth` permite hidratar desde el server cuando el layout es Server
 * Component y ya hizo la llamada. Cuando no se pasa, el provider corre
 * `getMe()` en el cliente al montar — pintando "loading" hasta resolver.
 */
export function AuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth?: AuthResponse;
}) {
  const [status, setStatus] = useState<AuthStatus>(
    initialAuth ? 'authenticated' : 'loading',
  );
  const [user, setUser] = useState<AuthResponse['user'] | null>(
    initialAuth?.user ?? null,
  );
  const [tenant, setTenant] = useState<AuthResponse['tenant'] | null>(
    initialAuth?.tenant ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Helper interno: setea los tres campos desde una AuthResponse. */
  const applyAuth = useCallback((auth: AuthResponse) => {
    setUser(auth.user);
    setTenant(auth.tenant);
    setStatus('authenticated');
    setErrorMessage(null);
  }, []);

  /** Helper interno: limpia todo y marca unauthenticated. */
  const clearAuth = useCallback(() => {
    setUser(null);
    setTenant(null);
    setStatus('unauthenticated');
    setErrorMessage(null);
  }, []);

  /**
   * Carga inicial: si no tenemos initialAuth, preguntamos al backend si
   * la cookie del browser es válida. AbortController limpia si el componente
   * se desmonta antes (StrictMode doble-render en dev).
   */
  useEffect(() => {
    if (initialAuth) return;

    const controller = new AbortController();
    (async () => {
      try {
        const auth = await getMe(controller.signal);
        applyAuth(auth);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          // Cookie ausente o inválida — flujo esperado, no es un error.
          clearAuth();
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setErrorMessage(msg);
      }
    })();

    return () => controller.abort();
  }, [initialAuth, applyAuth, clearAuth]);

  const login = useCallback(
    async (body: LoginRequest) => {
      // Mostrar "loading" mientras el backend valida (~100ms con bcrypt cost 12).
      setStatus('loading');
      try {
        const auth = await loginRequest(body);
        applyAuth(auth);
      } catch (err) {
        // Volvemos al estado previo "unauthenticated" para que el form pueda
        // re-habilitarse — NO marcamos status='error' (eso es para fallas de
        // sistema, no de credenciales). El caller del login() ve el ApiError
        // y muestra el mensaje en el form.
        clearAuth();
        throw err;
      }
    },
    [applyAuth, clearAuth],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // El logout es idempotente — si falla por red, igual limpiamos client-side
      // para que el usuario no quede atrapado. El backend, en su próximo intento
      // sin cookie, igual no autentica.
    }
    clearAuth();
  }, [clearAuth]);

  const refresh = useCallback(async () => {
    try {
      const auth = await getMe();
      applyAuth(auth);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setErrorMessage(msg);
    }
  }, [applyAuth, clearAuth]);

  // useMemo para que la referencia del value no cambie en cada render —
  // así los consumers solo re-renderizan cuando algún campo realmente cambió.
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      tenant,
      errorMessage,
      login,
      logout,
      refresh,
    }),
    [status, user, tenant, errorMessage, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
