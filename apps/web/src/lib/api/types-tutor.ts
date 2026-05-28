// -----------------------------------------------------------------------------
// Tipos del cliente del tutor (Demo 05).
//
// Espejo manual de los DTOs del backend (apps/api/src/app/tutor/) y de los
// constantes de pricing (cost/pricing.constants.ts). Convención:
//   - El frontend usa los mismos union literals que el backend exporta —
//     si el backend cambia, este archivo cambia en el mismo PR.
//   - Los nombres tienen prefijo `Tutor*` para no chocar con otras
//     primitivas (`ChatMessage`, `Pricing`...).
// -----------------------------------------------------------------------------

/** Niveles CEFR soportados por el tutor. Espejo de `TUTOR_LEVELS` del backend. */
export type TutorLevel = 'A2' | 'B1' | 'B2';

/** Escenarios de role-play. Espejo de `TUTOR_SCENARIOS` del backend. */
export type TutorScenario = 'general' | 'cafe' | 'interview';

/**
 * Un turno previo de la conversación. Solo permitimos 'user' | 'assistant';
 * el 'system' lo arma el backend desde level/scenario.
 */
export interface TutorHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Body del POST /api/v1/tutor/chat. */
export interface TutorChatRequest {
  history: TutorHistoryTurn[];
  message: string;
  level: TutorLevel;
  scenario?: TutorScenario;
}

/**
 * Tokens facturables de una request al LLM. Espejo de `ChatUsage` del
 * llm-adapter — los unimos acá porque el cliente del tutor es donde se
 * consumen para alimentar el cost calculator.
 */
export interface TutorUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Eventos del stream SSE. Cada `data:` del backend es un JSON con esta forma.
 * Discriminamos por `type` en el consumer.
 */
export type TutorStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'usage'; usage: TutorUsage };

/**
 * Handlers que el consumer pasa a `subscribeToTutorChat`. Mismo patrón que
 * los hooks de compare/chat/agent.
 */
export interface TutorStreamHandlers {
  onToken: (text: string) => void;
  onUsage?: (usage: TutorUsage) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface TutorSubscription {
  close: () => void;
}

// -----------------------------------------------------------------------------
// Pricing — GET /api/v1/tutor/pricing
// -----------------------------------------------------------------------------

/** Espejo de `ProviderPricing` del backend. */
export interface TutorProviderPricing {
  id: string;
  displayName: string;
  modelTier: string;
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
  capturedAt: string;
  sourceUrl: string;
}

/** Espejo de `NAI_ON_PREM` del backend. */
export interface TutorNaiOnPrem {
  id: string;
  displayName: string;
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
  notes: string[];
}

export interface TutorPricingResponse {
  providers: TutorProviderPricing[];
  naiOnPrem: TutorNaiOnPrem;
}
