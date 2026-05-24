// -----------------------------------------------------------------------------
// Chunker — divide un texto largo en fragmentos (chunks) listos para embebir.
//
// Por qué chunking: el context window del LLM es finito. Un PDF de 100 páginas
// no entra entero. Lo cortamos en fragmentos, embebemos cada uno, y al
// consultar buscamos solo los más relevantes.
//
// Patrón Strategy: cada algoritmo de chunking es una clase intercambiable
// detrás de la interface `ChunkerStrategy`. Por ahora solo está
// `SlidingWindowChunker` (ventana deslizante por caracteres, simple y general).
// Mañana se pueden sumar ParagraphChunker, RecursiveCharacterChunker, etc.
// -----------------------------------------------------------------------------

/**
 * Estrategia de chunking — convierte un texto en N fragmentos en orden.
 * El i-ésimo fragmento corresponderá al `index = i` cuando se guarde en la DB.
 */
export interface ChunkerStrategy {
  split(text: string): string[];
}

export interface SlidingWindowOptions {
  /** Tamaño máximo del chunk en caracteres. */
  size: number;
  /**
   * Caracteres que se solapan entre chunks consecutivos. Aumenta la chance
   * de que el contexto relevante caiga entero en al menos un chunk.
   */
  overlap: number;
}

/**
 * Ventana deslizante de tamaño fijo en caracteres, con solapamiento. Funciona
 * para cualquier texto (no asume estructura — ni párrafos ni oraciones).
 *
 * @example
 *   const chunker = new SlidingWindowChunker({ size: 800, overlap: 100 });
 *   const chunks = chunker.split(reglamentoCompleto);
 */
export class SlidingWindowChunker implements ChunkerStrategy {
  constructor(private readonly options: SlidingWindowOptions) {
    if (options.size <= 0) {
      throw new Error('SlidingWindowChunker: `size` debe ser mayor que 0.');
    }
    if (options.overlap < 0 || options.overlap >= options.size) {
      throw new Error(
        'SlidingWindowChunker: `overlap` debe ser >= 0 y < size.',
      );
    }
  }

  split(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const { size, overlap } = this.options;
    const step = size - overlap;
    const chunks: string[] = [];

    // Vamos avanzando `step` caracteres por vez, tomando una ventana de
    // `size`. Si la última ventana llega al final del texto, salimos.
    for (let start = 0; start < trimmed.length; start += step) {
      const end = Math.min(start + size, trimmed.length);
      const chunk = trimmed.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= trimmed.length) break;
    }

    return chunks;
  }
}
