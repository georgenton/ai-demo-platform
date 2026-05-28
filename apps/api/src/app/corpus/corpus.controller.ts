// -----------------------------------------------------------------------------
// CorpusController — HTTP layer del Demo 03 (Corpus académico).
//
// POST /api/v1/corpus/upload — multipart con varios PDFs ("files" plural).
// Procesamos cada uno secuencialmente: extract → metadata LLM → chunks. Si
// algunos fallan, devolvemos los éxitos + el tally.
// -----------------------------------------------------------------------------

import {
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CorpusIngestService } from './corpus-ingest.service.js';
import { CorpusUploadResponseDto } from './dto/corpus-upload.dto.js';

/** 10 MB por archivo — mismo límite que ingest base. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Tope de archivos por request — defensa contra abuso (el LLM se cobra
 *  por paper, no queremos un upload de 1000 PDFs accidentalmente). */
const MAX_FILES_PER_REQUEST = 20;

@ApiTags('Corpus (Demo 03)')
@Controller({ path: 'corpus' })
export class CorpusController {
  constructor(private readonly corpusIngest: CorpusIngestService) {}

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
        .addFileTypeValidator({ fileType: 'application/pdf' })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Express.Multer.File[],
  ): Promise<CorpusUploadResponseDto> {
    return this.corpusIngest.ingestBatch(files);
  }
}
