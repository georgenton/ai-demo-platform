// -----------------------------------------------------------------------------
// DTOs de las queries de stats del corpus.
//
// `papersByYear` alimenta el bar chart del frontend (Recharts). `topTopics`
// alimenta una lista/donut. Ambos son agregaciones SQL — no llaman al LLM.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';

export class PapersByYearItemDto {
  @ApiProperty({ description: 'Año de publicación', example: 2023 })
  year!: number;

  @ApiProperty({ description: 'Cantidad de papers en ese año', example: 12 })
  count!: number;
}

export class TopTopicItemDto {
  @ApiProperty({
    description: 'Tópico normalizado (lowercased)',
    example: 'educación',
  })
  topic!: string;

  @ApiProperty({
    description: 'Cantidad de papers que tienen ese tópico',
    example: 8,
  })
  count!: number;
}

export class CorpusStatsResponseDto {
  @ApiProperty({
    description: 'Total de papers en el corpus (demoId=corpus).',
    example: 42,
  })
  totalPapers!: number;

  @ApiProperty({
    description:
      'Papers agrupados por año, orden ascendente por año. Excluye papers ' +
      'sin año (year null).',
    type: [PapersByYearItemDto],
  })
  papersByYear!: PapersByYearItemDto[];

  @ApiProperty({
    description: 'Top 10 tópicos por frecuencia.',
    type: [TopTopicItemDto],
  })
  topTopics!: TopTopicItemDto[];
}
