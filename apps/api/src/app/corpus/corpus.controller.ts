// -----------------------------------------------------------------------------
// CorpusController — HTTP layer del Demo 03 (Corpus académico).
//
// POST /api/v1/corpus/upload — multipart con varios PDFs ("files" plural).
// Procesamos cada uno secuencialmente: extract → metadata LLM → chunks. Si
// algunos fallan, devolvemos los éxitos + el tally.
// -----------------------------------------------------------------------------

import {
  Controller,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Query,
  Sse,
  UploadedFiles,
  UseInterceptors,
  type MessageEvent,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ChatService } from '../chat/chat.service.js';

import { CorpusIngestService } from './corpus-ingest.service.js';
import { CorpusStatsService } from './corpus-stats.service.js';
import { CorpusSummaryService } from './corpus-summary.service.js';
import {
  CorpusPapersQueryDto,
  CorpusPapersResponseDto,
} from './dto/corpus-papers.dto.js';
import { CorpusSearchQueryDto } from './dto/corpus-search.dto.js';
import { CorpusStatsResponseDto } from './dto/corpus-stats.dto.js';
import { CorpusUploadResponseDto } from './dto/corpus-upload.dto.js';
import { CurrentTenant } from '../auth/current-user.decorator.js';

/** 10 MB por archivo — mismo límite que ingest base. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Tope de archivos por request — defensa contra abuso (el LLM se cobra
 *  por paper, no queremos un upload de 1000 PDFs accidentalmente). */
const MAX_FILES_PER_REQUEST = 20;

@ApiTags('Corpus (Demo 03)')
@Controller({ path: 'corpus' })
export class CorpusController {
  constructor(
    private readonly corpusIngest: CorpusIngestService,
    private readonly statsService: CorpusStatsService,
    private readonly summaryService: CorpusSummaryService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * POST /api/v1/corpus/upload
   *
   * Body multipart/form-data:
   *   - files (1..20 PDFs, máx 10MB cada uno)
   *
   * Procesa el batch. Si algunos fallan, no aborta — devuelve la lista de
   * exitosos + cuenta de fallidos. Los errores se loggean server-side.
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Ingestar un batch de papers académicos (multipart)',
    description:
      'Recibe 1..20 PDFs en una sola request. Por cada uno: extrae texto, ' +
      'llama al LLM para extraer metadata (título, año, autores, abstract, tópicos), ' +
      'genera chunks + embeddings (demoId="corpus"). Tope: 20 archivos por request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: CorpusUploadResponseDto })
  @ApiResponse({
    status: 422,
    description:
      'Algún archivo excede 10MB o no es application/pdf. Toda la request se rechaza.',
  })
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_REQUEST))
  async upload(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_PDF_BYTES })
        // skipMagicNumbersValidation: true → solo chequeamos el MIME que
        // declara el cliente, no los magic bytes del archivo. Sin esto,
        // NestJS 11+ usa la librería `file-type` para inspeccionar los
        // primeros bytes del PDF; algunos PDFs (bioRxiv/medRxiv y varios
        // generadores no estándar) tienen headers que esa librería no
        // reconoce y rechaza con un error confuso: "current file type is
        // application/pdf, expected type is application/pdf". El MIME
        // sigue enforced — un upload con Content-Type: text/plain se
        // rechaza igual.
        .addFileTypeValidator({
          fileType: 'application/pdf',
          skipMagicNumbersValidation: true,
        })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Express.Multer.File[],
    @CurrentTenant() tenantId: string,
  ): Promise<CorpusUploadResponseDto> {
    return this.corpusIngest.ingestBatch(files, tenantId);
  }

  /**
   * GET /api/v1/corpus/stats
   *
   * Agregaciones del corpus: total, papers por año, top 10 tópicos.
   * Sin LLM en este endpoint — todo SQL, respuesta inmediata.
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Stats agregados del corpus (sin LLM)',
    description:
      'Devuelve totalPapers, papersByYear[] y topTopics[]. Pensado para el bar chart de papers/año y el listado de top tópicos en el frontend del Demo 03.',
  })
  @ApiResponse({ status: 200, type: CorpusStatsResponseDto })
  async stats(
    @CurrentTenant() tenantId: string,
  ): Promise<CorpusStatsResponseDto> {
    return this.statsService.stats(tenantId);
  }

  /**
   * GET /api/v1/corpus/papers?limit=20&offset=0
   *
   * Listado paginado de papers con sus tópicos joineados. Ordenado por
   * fecha de ingest (más recientes primero) — útil para mostrar lo último
   * que se subió en la lista del frontend.
   */
  @Get('papers')
  @ApiOperation({
    summary: 'Listado paginado de papers del corpus',
    description:
      'Devuelve los papers ordenados por fecha de ingest descendente, con sus tópicos como array. Sin abstract por default (es grande); para ver detalle de un paper usar GET /api/v1/documents/:id.',
  })
  @ApiResponse({ status: 200, type: CorpusPapersResponseDto })
  async papers(
    @Query() query: CorpusPapersQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<CorpusPapersResponseDto> {
    return this.statsService.papers(
      {
        limit: query.limit,
        offset: query.offset,
      },
      tenantId,
    );
  }

  /**
   * GET /api/v1/corpus/search?q=...&topK=5
   *
   * Búsqueda semántica sobre el corpus + respuesta del LLM citando los
   * chunks relevantes. Es exactamente el mismo flujo del chat del Demo 01
   * — delegamos al ChatService con `demoId='corpus'` hardcoded.
   *
   * Por qué un endpoint separado en lugar de pedir al cliente que pegue
   * a /api/v1/chat con demoId='corpus': claridad en la API (cada demo en
   * su namespace) + el cliente del Demo 03 no necesita saber del demoId.
   */
  @Sse('search')
  @ApiOperation({
    summary: 'Búsqueda semántica sobre el corpus (SSE streaming)',
    description:
      'Embebe la pregunta, busca chunks relevantes en pgvector (filtrados por demoId=corpus) y streamea la respuesta del LLM. Delegate del Chat del Demo 01.',
  })
  search(
    @Query() query: CorpusSearchQueryDto,
    @CurrentTenant() tenantId: string,
  ): Observable<MessageEvent> {
    return from(
      this.chatService.streamChat(
        {
          q: query.q,
          demoId: 'corpus',
          topK: query.topK,
        },
        tenantId,
      ),
    ).pipe(map((token) => ({ data: token })));
  }

  /**
   * GET /api/v1/corpus/summary
   *
   * Resumen ejecutivo del corpus en 2-3 párrafos. Map-reduce con el LLM:
   *   - Map: resume cada paper en 1-2 frases (paralelo, cap 50 papers).
   *   - Reduce: con stats + resúmenes, redacta el panorama general.
   *
   * Tarda ~30-60s la primera vez para un corpus de 30-50 papers. Streamea
   * el resumen final token a token al cliente.
   *
   * Si el corpus tiene menos de 3 papers, devuelve un mensaje fijo (no
   * tiene sentido un resumen ejecutivo de tan poco).
   */
  @Sse('summary')
  @ApiOperation({
    summary: 'Resumen ejecutivo del corpus (SSE streaming)',
    description:
      'Map-reduce LLM: resume cada paper individualmente y después redacta el panorama del corpus en 2-3 párrafos. ~30-60s. Si total < 3 papers, devuelve mensaje fijo.',
  })
  summary(@CurrentTenant() tenantId: string): Observable<MessageEvent> {
    return from(this.summaryService.streamSummary(tenantId)).pipe(
      map((token) => ({ data: token })),
    );
  }
}
