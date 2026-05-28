// -----------------------------------------------------------------------------
// Constantes de pricing para el cost calculator del Demo 05.
//
// Por qué hardcoded y no env var:
//   - El pricing es público y NO secreto — no hay razón de seguridad para
//     ocultarlo.
//   - La calculadora muestra los números explícitamente al cliente; si el
//     pricing cambia, el código tiene que cambiar (no podemos rotarlo
//     silenciosamente con una env var).
//   - Cada entrada tiene `capturedAt` + `sourceUrl` — eso es lo que un
//     revisor exigiría para defender el cálculo en code review.
//
// Mantenimiento: cuando Anthropic cambie pricing, actualizar `pricePerMillion*`
// + `capturedAt` en el mismo PR, y ejecutar `npm test` — los tests del
// cost engine reflejan magnitudes esperadas y avisan si el orden de magnitud
// cambia drásticamente.
// -----------------------------------------------------------------------------

/** Pricing por proveedor (USD por millón de tokens). */
export interface ProviderPricing {
  /** Slug interno, también usado como key del frontend. */
  id: string;
  /** Nombre legible para el panel del demo. */
  displayName: string;
  /** Tier del modelo (ej. "Sonnet 4.x") — informativo. */
  modelTier: string;
  /** USD por 1.000.000 de tokens de entrada. */
  pricePerMillionInput: number;
  /** USD por 1.000.000 de tokens de salida. */
  pricePerMillionOutput: number;
  /** Fecha YYYY-MM-DD en que se capturaron estos números. */
  capturedAt: string;
  /** URL de la fuente oficial. */
  sourceUrl: string;
}

/**
 * Catálogo de proveedores comparados en pantalla. Hoy solo Anthropic Sonnet
 * (decisión ADR-0012). Si Edguitar pide sumar OpenAI o Gemini en QA, se
 * agregan acá y el frontend los pinta sin más cambios.
 */
export const PROVIDERS: readonly ProviderPricing[] = [
  {
    id: 'anthropic-sonnet',
    displayName: 'Anthropic Claude Sonnet',
    modelTier: 'Sonnet (claude-sonnet-4)',
    pricePerMillionInput: 3,
    pricePerMillionOutput: 15,
    capturedAt: '2026-05-28',
    sourceUrl: 'https://www.anthropic.com/pricing',
  },
] as const;

/**
 * NAI on-prem cost model. Lo modelamos explícito como "cero variable" para
 * que el discurso del demo se sostenga en el código, no solo en el deck.
 * Cuando Edguitar nos dé el CapEx real del hardware, se anota acá y el
 * frontend puede mostrar la cifra anualizada amortizada.
 */
export const NAI_ON_PREM = {
  id: 'nai-onprem',
  displayName: 'NAI on-premise (Nutanix Enterprise AI)',
  /** USD por 1.000.000 de tokens — fijo en cero por diseño. */
  pricePerMillionInput: 0,
  pricePerMillionOutput: 0,
  /** Notas para mostrar al lado del "$0" en la UI. */
  notes: [
    'Costo variable por consulta: $0.',
    'Costo fijo: hardware NAI + soporte Nutanix (CapEx separado, ver Edguitar).',
  ],
} as const;
