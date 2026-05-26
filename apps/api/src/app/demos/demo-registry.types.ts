// -----------------------------------------------------------------------------
// Tipos del catálogo de demos.
//
// Vive en un archivo aparte (no junto al service) porque son tipos puros sin
// runtime — los consume el controller para tipar la respuesta HTTP, los
// tests para fabricar fixtures, y eventualmente el frontend (cuando exista
// un paquete @org/contracts) para evitar drift.
// -----------------------------------------------------------------------------

/**
 * Estado de cada demo desde el punto de vista del usuario final:
 *   - `available`: terminado y listo para presentar.
 *   - `coming-soon`: en roadmap o en construcción. Lo mostramos para que el
 *     cliente vea el plan, pero la UI lo deja deshabilitado.
 */
export type DemoStatus = 'available' | 'coming-soon';

/**
 * Metadata visible de un demo. NO incluye configuración técnica (prompt
 * builder, tamaño de chunk, etc.) — eso vive dentro del módulo de cada demo.
 * Acá solo va lo que la UI necesita para pintar la cartelera.
 */
export interface DemoMetadata {
  /** ID estable usado en URLs, filtros de pgvector y demoId del frontend. */
  id: string;
  /** Título corto para mostrar en cards/sidebar. */
  title: string;
  /** Frase one-liner que vende el demo. Espejo del "Tagline" de CLAUDE.md. */
  tagline: string;
  /** 1–3 oraciones describiendo qué hace y cómo se usa. */
  description: string;
  /** Tipos de cliente para los que es relevante (universidades, RRHH, …). */
  audience: string[];
  /** Disponibilidad actual — controla si la UI lo habilita o lo deshabilita. */
  status: DemoStatus;
  /** Ruta del frontend donde vive el demo (ej. `/demo/rag`). */
  route: string;
}
