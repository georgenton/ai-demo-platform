// -----------------------------------------------------------------------------
// CorpusIngestService — pipeline de ingesta del Demo 03 (Corpus académico).
//
// Reusa toda la maquinaria del Demo 01 (IngestService → chunking + embeddings
// + pgvector) y agrega encima dos pasos exclusivos de corpus:
//   1) Extracción de metadata estructurada (título, año, autores, abstract,
//      tópicos) llamando al LLM sobre los primeros ~4KB del texto.
//   2) Persistencia de esos campos en Document (year/authors/abstract) +
//      tabla DocumentTopic (FK con cascade delete).
//
// Por qué un servicio aparte y no extender IngestService:
//   - IngestService es genérico, lo usan rag y comparator. Sumarle lógica
//     de extracción LLM acoplaría todos los demos a un costo que solo
//     necesita corpus.
//   - Mantenemos el principio: cada demo en su módulo, con su propia
//     orquestación. Compartimos building blocks (PdfTextExtractor,
//     IngestService) por inyección.
//
// Estrategia de errores en batch:
//   - Si un paper falla (PDF sin texto, LLM rate-limit, JSON inválido), lo
//     loggeamos y seguimos con los siguientes. La respuesta al cliente
//     muestra successCount/failureCount sin exponer detalles internos.
//   - El error de un paper no rolleabackea los anteriores (cada paper es
//     su propia unidad transaccional vía IngestService.ingest()).
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';
import { chat, type ChatProvider } from '@org/llm-adapter';

import { IngestService } from '../ingest/ingest.service.js';
import { PdfTextExtractor } from '../ingest/pdf-text-extractor.js';

import type {
  CorpusUploadItemDto,
  CorpusUploadResponseDto,
} from './dto/corpus-upload.dto.js';

/** Cantidad de chars del paper que mandamos al LLM para extraer metadata.
 *  4000 chars ≈ ~1k tokens — alcanza para título, autores y abstract en la
 *  primera página de cualquier tesis estándar. Más no aporta y cuesta más. */
const METADATA_EXCERPT_CHARS = 4000;

/** Prompt de extracción. Lo dejamos como constante exportable por si en el
 *  futuro queremos versionarlo o tener variantes (inglés, etc.). */
export const CORPUS_METADATA_SYSTEM_PROMPT = `Sos un asistente que extrae metadata estructurada de papers académicos.
Te paso el inicio del texto de un paper o tesis. Devolveme un JSON con
exactamente este shape, sin texto adicional ni explicación:

{
  "title": "string",
  "year": number | null,
  "authors": ["string", ...],
  "abstract": "string" | null,
  "topics": ["string", ...]
}

Reglas:
- title: el título del paper. Si no hay título claro, usá la primera línea
  prominente.
- year: el año de publicación (4 dígitos). Buscá patrones "20XX" o "19XX".
  Si no hay año claro, devolvé null.
- authors: lista de autores. Si no encontrás, devolvé array vacío.
- abstract: el resumen/abstract del paper si lo identificás claramente.
  Si no, null.
- topics: 3 a 5 tópicos clave del paper, una o dos palabras cada uno,
  en español, lowercased. Ej: ["educación", "machine learning",
  "inteligencia artificial"]. Estos sirven para agregación por tema
  en un gráfico de "top tópicos del corpus".

Devolvé SOLO el JSON, sin code fences ni texto antes/después.`;

/**
 * Forma del JSON que esperamos del LLM. Lo validamos defensive al parsear —
 * el LLM puede alucinar el shape ocasionalmente.
 */
interface ExtractedMetadata {
  title: string;
  year: number | null;
  authors: string[];
  abstract: string | null;
  topics: string[];
}

@Injectable()
export class CorpusIngestService {
  private readonly logger = new Logger(CorpusIngestService.name);

  constructor(
    private readonly ingestService: IngestService,
    private readonly pdfExtractor: PdfTextExtractor,
  ) {}

  /**
   * Procesa un batch de PDFs. Cada uno como unidad independiente — si uno
   * falla, los otros siguen. La respuesta cuenta éxitos y fallas.
   *
   * Pipeline por paper:
   *   1) Extract text del PDF.
   *   2) Ingest base (Document + chunks + embeddings) con demoId='corpus'.
   *   3) Extract metadata con LLM (title, year, authors, abstract, topics).
   *   4) Update Document con year/authors/abstract.
   *   5) Insert DocumentTopic rows.
   */
  async ingestBatch(
    files: Express.Multer.File[],
    tenantId: string,
    llmProvider?: ChatProvider,
  ): Promise<CorpusUploadResponseDto> {
    this.logger.log(
      `Batch ingest: ${files.length} files (tenant=${tenantId}, ` +
        `llmProvider=${llmProvider ?? 'env default'})`,
    );

    const items: CorpusUploadItemDto[] = [];
    let failureCount = 0;

    for (const file of files) {
      try {
        const item = await this.ingestOne(file, tenantId, llmProvider);
        items.push(item);
      } catch (err) {
        failureCount++;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Skipping "${file.originalname}" due to ingest error: ${msg}`,
        );
      }
    }

    this.logger.log(
      `Batch complete: ${items.length} ok, ${failureCount} failed`,
    );

    return {
      items,
      successCount: items.length,
      failureCount,
    };
  }

  /**
   * Procesa un único paper. Si algo falla, propaga la excepción para que
   * `ingestBatch` la cuente como falla.
   */
  private async ingestOne(
    file: Express.Multer.File,
    tenantId: string,
    llmProvider?: ChatProvider,
  ): Promise<CorpusUploadItemDto> {
    // 1) Extract text del PDF.
    const text = await this.pdfExtractor.extractText(file.buffer);
    if (!text || text.trim().length === 0) {
      throw new Error('PDF sin texto extraíble');
    }

    // 2) Ingest base — esto crea Document + chunks + embeddings y devuelve
    //    el documentId. demoId='corpus' marca al Document como parte del
    //    Demo 03 para que las queries de stats lo encuentren. Propagamos
    //    el llmProvider para que el ingest respete el dropdown del header
    //    (ver ADR-0018).
    const ingestResult = await this.ingestService.ingest(
      {
        name: file.originalname,
        content: text,
        demoId: 'corpus',
      },
      tenantId,
      llmProvider,
    );

    // 3) Extract metadata con LLM. Usamos solo los primeros chars del paper
    //    porque toda la metadata útil (título, autores, abstract) está al
    //    principio. Eso baja costo y mejora el match.
    const excerpt = text.slice(0, METADATA_EXCERPT_CHARS);
    const metadata = await this.extractMetadataViaLLM(excerpt, llmProvider);

    // 4) Update Document con year/authors/abstract.
    await prisma.document.update({
      where: { id: ingestResult.documentId },
      data: {
        year: metadata.year,
        authors: metadata.authors,
        abstract: metadata.abstract,
      },
    });

    // 5) Insert DocumentTopic rows. createMany es atómico y rápido.
    if (metadata.topics.length > 0) {
      await prisma.documentTopic.createMany({
        data: metadata.topics.map((topic) => ({
          documentId: ingestResult.documentId,
          topic: this.normalizeTopic(topic),
        })),
      });
    }

    return {
      documentId: ingestResult.documentId,
      name: file.originalname,
      title: metadata.title,
      year: metadata.year,
      authors: metadata.authors,
      topics: metadata.topics.map((t) => this.normalizeTopic(t)),
      chunkCount: ingestResult.chunkCount,
    };
  }

  /**
   * Llama al LLM y parsea la metadata. Devuelve defaults seguros si el LLM
   * responde con JSON inválido — no queremos que un parse error bloquee el
   * ingest entero (el Document base ya está creado con sus chunks).
   */
  private async extractMetadataViaLLM(
    excerpt: string,
    llmProvider?: ChatProvider,
  ): Promise<ExtractedMetadata> {
    // Acumulamos el stream y parseamos. El completeStream actual es la
    // única forma de hablar con el LLM en este código — no requerimos
    // streaming acá, pero ese es el método disponible y funciona bien.
    //
    // Pasamos el llmProvider override para que el dropdown del header
    // también afecte esta llamada (consistencia con el resto del PR).
    let fullText = '';
    for await (const token of chat.completeStream(
      [
        { role: 'system', content: CORPUS_METADATA_SYSTEM_PROMPT },
        { role: 'user', content: excerpt },
      ],
      { provider: llmProvider },
    )) {
      fullText += token;
    }

    return this.parseMetadataResponse(fullText);
  }

  /**
   * Parsea la respuesta del LLM. El LLM a veces incluye code fences
   * (```json ... ```) o texto antes/después aunque le pidamos solo JSON —
   * limpiamos antes de parsear.
   *
   * Si el shape no matchea o el parse falla, devolvemos defaults vacíos
   * (title=filename del paper, year=null, sin autores, sin tópicos). El
   * Document igual queda guardado y buscable; solo le falta metadata rica.
   */
  private parseMetadataResponse(raw: string): ExtractedMetadata {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.logger.warn(
        'LLM metadata response is not valid JSON; using empty defaults',
      );
      return this.emptyMetadata();
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return this.emptyMetadata();
    }
    const p = parsed as Record<string, unknown>;

    return {
      title: typeof p.title === 'string' ? p.title.trim() : 'Sin título',
      year: this.coerceYear(p.year),
      authors: this.coerceStringArray(p.authors),
      abstract: typeof p.abstract === 'string' ? p.abstract.trim() : null,
      topics: this.coerceStringArray(p.topics).slice(0, 5),
    };
  }

  private emptyMetadata(): ExtractedMetadata {
    return {
      title: 'Sin título',
      year: null,
      authors: [],
      abstract: null,
      topics: [],
    };
  }

  /** Acepta `number` o string parseable; rechaza años fuera de [1900, 2100]. */
  private coerceYear(value: unknown): number | null {
    let n: number | null = null;
    if (typeof value === 'number') n = value;
    else if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) n = parsed;
    }
    if (n === null) return null;
    if (n < 1900 || n > 2100) return null;
    return n;
  }

  private coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());
  }

  /** Tópicos en minúscula y trim para que "Educación" e "educación" agreguen
   *  juntos en el "top tópicos". */
  private normalizeTopic(topic: string): string {
    return topic.toLowerCase().trim();
  }
}
