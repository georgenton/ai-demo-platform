// Tipos espejo del endpoint /api/v1/compare.
// Ver ADR-0010 para la decisión de duplicar tipos vs paquete compartido.

import type { DemoId } from './types';

export interface CompareRequest {
  /** 2–5 IDs de documentos ya ingestados. */
  documentIds: string[];
  /** 1–10 dimensiones (ejes de comparación). */
  dimensions: string[];
  demoId?: DemoId;
}

/**
 * Callbacks del stream SSE del comparador. El stream emite solo eventos
 * `data:` con texto plano (tokens del LLM), igual que el chat. No usa
 * tipos de evento — todo es token.
 */
export interface CompareStreamHandlers {
  onToken: (token: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface CompareSubscription {
  /** Cancela el stream. Idempotente. */
  close: () => void;
}
