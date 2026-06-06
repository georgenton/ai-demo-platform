// -----------------------------------------------------------------------------
// CorpusSummaryService — resumen ejecutivo del corpus vía map-reduce LLM.
//
// Cómo funciona (en analogía):
//   Imaginate un bibliotecario que tiene que escribir el "estado del arte"
//   de una colección de 30 tesis. No las puede leer todas en detalle: lee
//   solo el abstract de cada una (paso "map"), arma un fajo de fichas, y
//   después con todo el fajo enfrente redacta el resumen ejecutivo (paso
//   "reduce"). Eso es lo que hacemos acá con el LLM.
//
//   - MAP: por cada paper con abstract, el LLM lo resume en 1-2 frases.
//     Llamadas en paralelo con concurrency limit.
//   - REDUCE: con la lista de resúmenes individuales + stats agregados
//     (años, tópicos top), el LLM redacta el resumen ejecutivo final.
//     Se streamea token a token via SSE.
//
// Optimizaciones / límites:
//   - Si total papers < 3, no tiene sentido un resumen. Devolvemos mensaje
//     fijo y terminamos.
//   - Si total papers > 50, tomamos solo los 50 más recientes para el map
//     (el costo y latencia se vuelven prohibitivos sino).
//   - Map con concurrency=5 — balance entre paralelo y rate limits del
//     provider. Anthropic permite varios req/sec; OpenAI también. 5
//     simultáneos cubre 50 papers en ~30s sin pisar límites.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';
import type { ChatProvider } from '@org/llm-adapter';

import { CorpusStatsService } from './corpus-stats.service.js';

const DEMO_ID = 'corpus';

/** Cantidad mínima de papers para considerar generar un resumen. */
const MIN_PAPERS_FOR_SUMMARY = 3;

/** Cap de papers a procesar — costo/latencia se vuelve prohibitivo arriba. */
const MAX_PAPERS_FOR_SUMMARY = 50;

/** Cuántas llamadas LLM en paralelo durante el map. */
const MAP_CONCURRENCY = 5;

/** Cap por paper-summary para no inflar el prompt del reduce. */
const PAPER_SUMMARY_MAX_CHARS = 300;

const MAP_SYSTEM_PROMPT = `Sos un asistente que resume papers académicos.
Te paso título + año + autores + abstract de un paper. Devolveme un resumen
de UNA o DOS frases en español, sin viñetas, sin "Este paper", sin meta-
discurso. Solo la idea central + aporte principal. Máximo 60 palabras.`;

const REDUCE_SYSTEM_PROMPT = `Sos un analista de corpus académicos.
Te paso (a) stats agregados del corpus (cantidad de papers, distribución por
año, top tópicos) y (b) una lista de resúmenes ultracortos de los papers.

Redactá un "resumen ejecutivo" del corpus de 2-3 párrafos en español, con
este shape:
  - Párrafo 1: panorama general — cantidad de papers, rango temporal,
    áreas dominantes.
  - Párrafo 2: temas y tendencias — qué tópicos predominan, qué evolución
    se observa si los años lo permiten.
  - Párrafo 3 (opcional): cierre — qué insight macro emerge.

Tono profesional, prosa fluida, sin viñetas. No menciones "este corpus"
muchas veces. Cita números concretos cuando aportan (ej. "23 papers entre
2018 y 2024"). Sin meta-discurso ("voy a hablar de...").`;

@Injectable()
export class CorpusSummaryService {
  private readonly logger = new Logger(CorpusSummaryService.name);

  constructor(private readonly statsService: CorpusStatsService) {}

  /**
   * Stream del resumen ejecutivo. Pasos:
   *   1) fetch stats + papers más recientes (cap MAX_PAPERS)
   *   2) Si total < MIN, emit mensaje fijo y termina
   *   3) MAP: resumen por paper en paralelo (cap MAP_CONCURRENCY)
   *   4) REDUCE: prompt con stats + resúmenes, streamea al cliente
   */
  async *streamSummary(
    tenantId: string,
    llmProvider?: ChatProvider,
  ): AsyncIterable<string> {
    const stats = await this.statsService.stats(tenantId);

    if (stats.totalPapers < MIN_PAPERS_FOR_SUMMARY) {
      yield `El corpus tiene solo ${stats.totalPapers} paper(s). ` +
        `Carga al menos ${MIN_PAPERS_FOR_SUMMARY} para que el resumen ` +
        `ejecutivo sea significativo.`;
      return;
    }

    this.logger.log(
      `Summary map-reduce: tenant=${tenantId} total=${stats.totalPapers}, will process up to ${MAX_PAPERS_FOR_SUMMARY}`,
    );

    // Traemos los papers más recientes con abstract no-null (los que no
    // tienen abstract no pueden aportar al map). Si no hay ningún abstract,
    // emitimos disclaimer y usamos solo metadata.
    const papers = await prisma.document.findMany({
      where: { tenantId, demoId: DEMO_ID },
      orderBy: { createdAt: 'desc' },
      take: MAX_PAPERS_FOR_SUMMARY,
      select: {
        name: true,
        year: true,
        authors: true,
        abstract: true,
      },
    });
    // El schema no tiene un campo `title` separado — usamos `name` (filename
    // del PDF) como heurística de título en el prompt del LLM. Si en un
    // futuro agregamos un `title` extraído, lo usamos acá.

    // MAP: resúmenes por paper, con concurrency limit.
    const paperSummaries = await this.mapPaperSummaries(papers);

    // REDUCE: streamea el resumen ejecutivo al cliente.
    const reducePrompt = this.buildReducePrompt(stats, paperSummaries);
    for await (const token of chat.completeStream(
      [
        { role: 'system', content: REDUCE_SYSTEM_PROMPT },
        { role: 'user', content: reducePrompt },
      ],
      { provider: llmProvider },
    )) {
      yield token;
    }
  }

  /**
   * Resume cada paper con una sola llamada al LLM. Procesa en lotes de
   * `MAP_CONCURRENCY` para no saturar rate limits.
   *
   * Si un paper falla (LLM rate limit, timeout), lo skipeamos — el resumen
   * final sigue siendo útil con N-1 papers.
   */
  private async mapPaperSummaries(
    papers: {
      name: string;
      year: number | null;
      authors: string[];
      abstract: string | null;
    }[],
  ): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < papers.length; i += MAP_CONCURRENCY) {
      const batch = papers.slice(i, i + MAP_CONCURRENCY);
      const summaries = await Promise.all(
        batch.map((p) => this.summarizeOnePaper(p).catch(() => null)),
      );
      for (const s of summaries) {
        if (s) results.push(s);
      }
    }

    return results;
  }

  /**
   * Una llamada LLM por paper. Si el abstract es null, usamos solo
   * título/año/autores — peor resumen pero algo aporta.
   */
  private async summarizeOnePaper(paper: {
    name: string;
    year: number | null;
    authors: string[];
    abstract: string | null;
  }): Promise<string> {
    const meta = [
      `Título/archivo: ${paper.name}`,
      paper.year ? `Año: ${paper.year}` : null,
      paper.authors.length > 0 ? `Autores: ${paper.authors.join(', ')}` : null,
      paper.abstract ? `Abstract:\n${paper.abstract}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    let fullText = '';
    for await (const token of chat.completeStream([
      { role: 'system', content: MAP_SYSTEM_PROMPT },
      { role: 'user', content: meta },
    ])) {
      fullText += token;
    }

    const trimmed = fullText.trim();
    return trimmed.length > PAPER_SUMMARY_MAX_CHARS
      ? trimmed.slice(0, PAPER_SUMMARY_MAX_CHARS) + '…'
      : trimmed;
  }

  /** Arma el prompt del reduce con stats + lista de resúmenes. */
  private buildReducePrompt(
    stats: {
      totalPapers: number;
      papersByYear: { year: number; count: number }[];
      topTopics: { topic: string; count: number }[];
    },
    paperSummaries: string[],
  ): string {
    const yearsLine =
      stats.papersByYear.length > 0
        ? stats.papersByYear.map((y) => `${y.year} (${y.count})`).join(', ')
        : 'sin años extraídos';
    const topicsLine = stats.topTopics
      .map((t) => `${t.topic} (${t.count})`)
      .join(', ');

    return [
      '## Stats del corpus',
      `Total: ${stats.totalPapers} papers`,
      `Distribución por año: ${yearsLine}`,
      `Top tópicos: ${topicsLine || 'ninguno extraído'}`,
      '',
      '## Resúmenes ultracortos de cada paper',
      paperSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ].join('\n');
  }
}
