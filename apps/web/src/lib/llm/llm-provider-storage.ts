// -----------------------------------------------------------------------------
// Helpers puros (sin React/JSX) para el provider del LLM.
//
// Vive separado del Context React (llm-provider-context.tsx) para que el
// código que invoca fetch/SSE pueda importar sin arrastrar el bundle de
// React Context, y para que vitest pueda transpilar como TS plano (los
// tests que importan desde `lib/api/*` no soportan JSX automáticamente).
// -----------------------------------------------------------------------------

/**
 * Providers que el dropdown ofrece. Espejo del subset usable del union
 * `ChatProvider` del backend — `fake` se excluye porque solo aplica a CI.
 */
export type LlmProviderId = 'anthropic' | 'private-mac';

export const STORAGE_KEY = 'adp-llm-provider';

const VALID: ReadonlySet<LlmProviderId> = new Set(['anthropic', 'private-mac']);

/**
 * Lectura directa de localStorage para código no-React. Usado por los
 * clientes HTTP/SSE para armar el header `X-LLM-Provider`.
 *
 * Devuelve `null` si:
 *   - `localStorage` no está disponible (SSR, sandboxed iframe).
 *   - No hay valor guardado.
 *   - El valor guardado no es un provider válido (defensa anti-corrupción).
 */
export function getActiveLlmProvider(): LlmProviderId | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored as LlmProviderId)) {
      return stored as LlmProviderId;
    }
  } catch {
    // ignoramos
  }
  return null;
}

/**
 * Helper que devuelve `{ 'X-LLM-Provider': value }` si hay provider
 * elegido, o `{}` si no. Spread en cualquier headers init.
 */
export function llmProviderHeader(): Record<string, string> {
  const p = getActiveLlmProvider();
  return p ? { 'X-LLM-Provider': p } : {};
}
