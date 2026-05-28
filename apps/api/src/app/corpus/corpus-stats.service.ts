// -----------------------------------------------------------------------------
// CorpusStatsService — queries de agregación + listado paginado.
//
// Sin LLM en este servicio: todo SQL. Tres queries:
//   1) stats(): totalPapers, papersByYear[], topTopics[]
//   2) papers({limit, offset}): listado paginado con tópicos joined
//
// El index compuesto (demoId, year) + el index en topic.topic hacen que estas
// queries sean cheap incluso con miles de docs. Más allá de eso, agregamos
// caching pero ya con números reales (premature optimization).
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';

import type {
  CorpusPaperItemDto,
  CorpusPapersResponseDto,
} from './dto/corpus-papers.dto.js';
import type {
  CorpusStatsResponseDto,
  PapersByYearItemDto,
  TopTopicItemDto,
} from './dto/corpus-stats.dto.js';

/** Solo agrupamos/filtramos por demoId='corpus' — es el ID del Demo 03. */
const DEMO_ID = 'corpus';

/** Top N tópicos a devolver. Ajustable si la UI quiere mostrar más/menos. */
const TOP_TOPICS_LIMIT = 10;

@Injectable()
export class CorpusStatsService {
  private readonly logger = new Logger(CorpusStatsService.name);

  /**
   * Agregaciones del corpus. Tres queries en paralelo:
   *   - COUNT total
   *   - GROUP BY year (excluyendo nulls — papers sin año no entran al bar chart)
   *   - GROUP BY topic, ORDER BY count DESC LIMIT 10
   */
  async stats(): Promise<CorpusStatsResponseDto> {
    const [totalPapers, papersByYear, topTopics] = await Promise.all([
      this.totalPapers(),
      this.papersByYear(),
      this.topTopics(),
    ]);

    this.logger.log(
      `Corpus stats: ${totalPapers} papers, ${papersByYear.length} years, ${topTopics.length} top topics`,
    );

    return { totalPapers, papersByYear, topTopics };
  }

  /** COUNT(*) WHERE demoId='corpus'. */
  private async totalPapers(): Promise<number> {
    return prisma.document.count({ where: { demoId: DEMO_ID } });
  }

  /**
   * SELECT year, COUNT(*) WHERE demoId='corpus' AND year IS NOT NULL
   * GROUP BY year ORDER BY year ASC.
   *
   * Usamos `groupBy` de Prisma (no $queryRaw) — más simple y type-safe.
   * El index (demoId, year) cubre el WHERE+GROUP exactamente.
   */
  private async papersByYear(): Promise<PapersByYearItemDto[]> {
    const rows = await prisma.document.groupBy({
      by: ['year'],
      where: {
        demoId: DEMO_ID,
        year: { not: null },
      },
      _count: { _all: true },
      orderBy: { year: 'asc' },
    });

    // `year` está tipado como `number | null` aunque el filter excluye nulls
    // — TS no lo deriva. Asserción segura porque el WHERE garantiza no-null.
    return rows
      .filter((r): r is typeof r & { year: number } => r.year !== null)
      .map((r) => ({ year: r.year, count: r._count._all }));
  }

  /**
   * SELECT topic, COUNT(*) FROM DocumentTopic dt
   *   JOIN Document d ON d.id = dt.documentId
   *   WHERE d.demoId='corpus'
   *   GROUP BY topic
   *   ORDER BY COUNT(*) DESC
   *   LIMIT 10
   *
   * Prisma no permite ORDER BY de count en groupBy directamente — uso
   * raw query para evitar workaround feo. Index en `topic` hace el GROUP
   * BY eficiente; el JOIN usa el FK con cascade.
   */
  private async topTopics(): Promise<TopTopicItemDto[]> {
    const rows = await prisma.$queryRaw<{ topic: string; count: bigint }[]>`
      SELECT dt."topic", COUNT(*) AS count
      FROM "DocumentTopic" dt
      JOIN "Document" d ON d."id" = dt."documentId"
      WHERE d."demoId" = ${DEMO_ID}
      GROUP BY dt."topic"
      ORDER BY count DESC
      LIMIT ${TOP_TOPICS_LIMIT}
    `;

    // COUNT(*) en Postgres devuelve bigint — Prisma lo serializa así. JSON
    // no soporta bigint nativo, así que convertimos a number (los counts
    // del demo no pasan de miles, lejos de Number.MAX_SAFE_INTEGER).
    return rows.map((r) => ({ topic: r.topic, count: Number(r.count) }));
  }

  /**
   * Listado paginado de papers del corpus, con tópicos como array.
   *
   * Dos queries: COUNT total para paginación + SELECT con JOIN a topics.
   * Las dos en paralelo. Limit/offset son del caller (controller valida
   * rangos con class-validator).
   */
  async papers(opts: {
    limit?: number;
    offset?: number;
  }): Promise<CorpusPapersResponseDto> {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    const [total, docs] = await Promise.all([
      this.totalPapers(),
      prisma.document.findMany({
        where: { demoId: DEMO_ID },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          topics: {
            select: { topic: true },
            orderBy: { topic: 'asc' },
          },
        },
      }),
    ]);

    const items: CorpusPaperItemDto[] = docs.map((d) => ({
      id: d.id,
      name: d.name,
      year: d.year,
      authors: d.authors,
      topics: d.topics.map((t) => t.topic),
      createdAt: d.createdAt.toISOString(),
    }));

    return { items, total, limit, offset };
  }
}
