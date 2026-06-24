// -----------------------------------------------------------------------------
// Helpers puros (sin React/JSX) para el provider del LLM.
//
// Vive separado del Context React (llm-provider-context.tsx) para que el
// código que invoca fetch/SSE pueda importar sin arrastrar el bundle de
// React Context, y para que vitest pueda transpilar como TS plano (los
// tests que importan desde `lib/api/*` no soportan JSX automáticamente).
// -----------------------------------------------------------------------------

/**
 * Providers que el frontend acepta — espejo del union `ChatProvider` del
 * backend menos `fake` (CI/tests). Después del ADR-0022 sumamos
 * `openai-compat` y `private-onprem` para reflejar las 4 alternativas que
 * el admin puede elegir en /admin/tenant.
 */
export type LlmProviderId =
  | 'anthropic'
  | 'openai-compat'
  | 'private-mac'
  | 'private-onprem';

/**
 * Storage key del **override manual** del user. Tiene prioridad sobre el
 * valor del tenant — el user puede forzarlo desde el dropdown del header
 * para depurar / comparar.
 */
export const STORAGE_KEY = 'adp-llm-provider';

/**
 * Storage key del provider **del tenant** (poblado por `useMyDemos` al
 * cargar). Es la fuente normal cuando no hay override manual. Si el admin
 * cambia el `llmProvider` del tenant en /admin/tenant, el frontend
 * actualiza este key y los próximos requests llevan el header nuevo.
 *
 * Vive en localStorage (no en cookie) porque solo el frontend lo lee —
 * para mandarlo al header `X-LLM-Provider` de cada fetch / query param de
 * EventSource.
 */
export const TENANT_STORAGE_KEY = 'adp-tenant-llm-provider';

const VALID: ReadonlySet<LlmProviderId> = new Set([
  'anthropic',
  'openai-compat',
  'private-mac',
  'private-onprem',
]);

function readKey(key: string): LlmProviderId | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && VALID.has(stored as LlmProviderId)) {
      return stored as LlmProviderId;
    }
  } catch {
    // ignoramos
  }
  return null;
}

/**
 * Lectura directa de localStorage para código no-React. Usado por los
 * clientes HTTP/SSE para armar el header `X-LLM-Provider` o el query
 * param `llmProvider`.
 *
 * Orden de precedencia:
 *   1. Override manual del user (`STORAGE_KEY`) — útil para QA y debug.
 *   2. Provider del tenant (`TENANT_STORAGE_KEY`) — lo seteó el admin
 *      en /admin/tenant; cae al frontend vía `/me/demos`.
 *   3. `null` → el adapter del backend cae al `CHAT_PROVIDER` del env
 *      (path legacy).
 *
 * Defensas:
 *   - `localStorage` no disponible (SSR, sandboxed iframe) → null.
 *   - Valor corrupto que no matchea el enum → null.
 */
export function getActiveLlmProvider(): LlmProviderId | null {
  return readKey(STORAGE_KEY) ?? readKey(TENANT_STORAGE_KEY);
}

/**
 * Helper que devuelve `{ 'X-LLM-Provider': value }` si hay provider
 * elegido, o `{}` si no. Spread en cualquier headers init.
 */
export function llmProviderHeader(): Record<string, string> {
  const p = getActiveLlmProvider();
  return p ? { 'X-LLM-Provider': p } : {};
}

/**
 * Guarda (o limpia) el provider del tenant en localStorage. Lo llama el
 * hook `useMyDemos` cada vez que carga `meDemos.tenant.llmProvider`, y la
 * UI de /admin/tenant después de un PATCH exitoso. Vivir en este módulo
 * mantiene el conocimiento del schema de storage en un solo archivo.
 */
export function setTenantLlmProvider(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value && VALID.has(value as LlmProviderId)) {
      window.localStorage.setItem(TENANT_STORAGE_KEY, value);
    } else {
      // null o valor inválido → limpiar. El next read cae al env del backend.
      window.localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  } catch {
    // ignoramos
  }
}
