// -----------------------------------------------------------------------------
// Tests del PdfTextExtractor — mockeamos `unpdf` para no depender de un PDF
// real ni de la librería en los tests unitarios.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExtractText } = vi.hoisted(() => ({
  mockExtractText: vi.fn(),
}));

vi.mock('unpdf', () => ({
  extractText: mockExtractText,
}));

import { PdfTextExtractor } from './pdf-text-extractor.js';

describe('PdfTextExtractor.extractText()', () => {
  let extractor: PdfTextExtractor;

  beforeEach(() => {
    mockExtractText.mockReset();
    extractor = new PdfTextExtractor();
  });

  it('junta las páginas con \\n\\n cuando unpdf devuelve text[]', async () => {
    mockExtractText.mockResolvedValue({
      totalPages: 3,
      text: ['página uno', 'página dos', 'página tres'],
    });

    const result = await extractor.extractText(Buffer.from('fake pdf'));

    expect(result).toBe('página uno\n\npágina dos\n\npágina tres');
    expect(mockExtractText).toHaveBeenCalledOnce();
    // unpdf espera Uint8Array; verificamos que le pasamos uno (no Buffer crudo).
    const arg = mockExtractText.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Uint8Array);
  });

  it('acepta text como string plano (PDF de una sola página)', async () => {
    mockExtractText.mockResolvedValue({
      totalPages: 1,
      text: 'todo el contenido junto',
    });

    const result = await extractor.extractText(Buffer.from('fake'));

    expect(result).toBe('todo el contenido junto');
  });

  it('hace trim del resultado (PDFs suelen tener whitespace al principio/final)', async () => {
    mockExtractText.mockResolvedValue({
      totalPages: 1,
      text: '   \n  texto real   \n   ',
    });

    expect(await extractor.extractText(Buffer.from('fake'))).toBe('texto real');
  });

  it('devuelve string vacía cuando el PDF no tiene texto extraíble', async () => {
    // Caso típico: PDF escaneado sin OCR. No falla — el IngestService es
    // quien decide qué hacer con string vacía (devolver 400).
    mockExtractText.mockResolvedValue({ totalPages: 5, text: [] });

    expect(await extractor.extractText(Buffer.from('fake'))).toBe('');
  });
});
