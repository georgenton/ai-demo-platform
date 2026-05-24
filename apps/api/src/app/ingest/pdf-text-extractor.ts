// -----------------------------------------------------------------------------
// PdfTextExtractor — encapsula la librería de extracción de texto de PDFs.
//
// Hoy usa `unpdf`: modern, ESM-friendly, diseñada para entornos serverless.
// Si mañana queremos algo distinto (pdfjs-dist crudo, una API externa para
// PDFs escaneados con OCR, el ai-service de Python con PyMuPDF…), cambia esta
// clase y nada más en el resto del proyecto.
//
// Por qué clase separada (en vez de inline en el controller):
//   - Responsabilidad única (extracción vs orquestación de ingesta).
//   - Inyectable → mockeable en tests.
//   - Encapsula la dependencia de runtime (`unpdf`).
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { extractText } from 'unpdf';

@Injectable()
export class PdfTextExtractor {
  private readonly logger = new Logger(PdfTextExtractor.name);

  /**
   * Extrae el texto plano de un PDF.
   * @param buffer Bytes del PDF (lo da Multer cuando se sube el archivo).
   * @returns Texto extraído, con páginas separadas por dos newlines.
   */
  async extractText(buffer: Buffer): Promise<string> {
    // unpdf devuelve text como string[] (una entrada por página) cuando le
    // pasamos un PDF multipágina. Lo juntamos con \n\n — el chunker después
    // hace su trabajo independientemente de cómo lleguen los párrafos.
    const { totalPages, text } = await extractText(new Uint8Array(buffer));

    const joined = Array.isArray(text) ? text.join('\n\n') : text;
    const trimmed = joined.trim();

    this.logger.log(
      `Extracted ${trimmed.length} chars from PDF (${totalPages} page${totalPages === 1 ? '' : 's'})`,
    );

    return trimmed;
  }
}
