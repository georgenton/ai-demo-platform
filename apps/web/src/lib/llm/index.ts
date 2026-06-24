// Barrel del módulo LLM (solo provider switch en esta primera vuelta).
//
// IMPORTANTE: los helpers puros (`getActiveLlmProvider`, `llmProviderHeader`)
// viven en `llm-provider-storage.ts` (sin React/JSX). El Context React vive
// en `llm-provider-context.tsx`. Esto permite que los clientes HTTP/SSE
// importen los helpers sin arrastrar React al bundle.

export {
  getActiveLlmProvider,
  llmProviderHeader,
  setTenantLlmProvider,
  STORAGE_KEY,
  TENANT_STORAGE_KEY,
  type LlmProviderId,
} from './llm-provider-storage';

export { LlmProviderProvider, useLlmProvider } from './llm-provider-context';
