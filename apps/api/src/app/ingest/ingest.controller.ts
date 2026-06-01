// HTTP layer del /api/v1/ingest (JSON) y /api/v1/ingest/file (multipart).
// El versionado URI lo configura main.ts (defaultVersion: '1'), así que este
// controller no necesita decir explícitamente `version: '1'`.

import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentTenant } from '../auth/current-user.decorator.js';
import { IngestFileBodyDto } from './dto/ingest-file.dto.js';
import { IngestRequestDto, IngestResponseDto } from './dto/ingest.dto.js';
import { IngestService } from './ingest.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';

/** 10 MB — un reglamento típico cabe holgado; archivos más grandes hoy son anomalía. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

@ApiTags('Ingest')
@Controller({ path: 'ingest' })
export class IngestController {
  constructor(
    private readonly ingestService: IngestService,
    private readonly pdfExtractor: PdfTextExtractor,
  ) {}

  /**
   * POST /api/v1/ingest
   *
   * Body (JSON):
   *   { name: string, content: string, demoId: string }
   *
   * Responde 201 con { documentId, chunkCount } cuando el documento se
   * indexó correctamente. 400 si el body no valida o el contenido no
   * produjo chunks. Para subir un PDF, ver POST /api/v1/ingest/file.
   */
  @Post()
  @ApiOperation({
    summary: 'Ingestar un documento (texto plano)',
    description:
      'Recibe el contenido como string, lo chunkea, genera embeddings y persiste todo atómicamente. Para PDFs usar POST /ingest/file.',
  })
  @ApiResponse({ status: 201, type: IngestResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Body inválido o sin chunks producidos.',
  })
  async ingest(
    @Body() dto: IngestRequestDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IngestResponseDto> {
    return this.ingestService.ingest(dto, tenantId);
  }

  /**
   * POST /api/v1/ingest/file
   *
   * Body (multipart/form-data):
   *   - file (binary, application/pdf, máx 10 MB)
   *   - demoId (string)
   *
   * NestJS valida tamaño + mime type via ParseFilePipeBuilder; si falla,
   * responde 422 antes de tocar el archivo. Si el PDF no tiene texto
   * extraíble (típico de escaneos sin OCR), responde 400.
   */
  @Post('file')
  @ApiOperation({
    summary: 'Ingestar un PDF (multipart)',
    description:
      'Sube un PDF, extrae el texto server-side con unpdf, y lo procesa igual que /ingest. Máx 10 MB, mime application/pdf.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'demoId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        demoId: { type: 'string', example: 'rag' },
      },
    },
  })
  @ApiResponse({ status: 201, type: IngestResponseDto })
  @ApiResponse({
    status: 400,
    description: 'PDF sin texto extraíble (escaneo sin OCR).',
  })
  @ApiResponse({
    status: 422,
    description: 'Tamaño > 10MB o mime distinto de application/pdf.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async ingestFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_PDF_BYTES })
        // Ver comentario análogo en corpus.controller.ts — desactivamos
        // la validación de magic numbers porque rechaza PDFs válidos
        // generados por herramientas no estándar (bioRxiv, medRxiv, etc.).
        // El MIME del cliente sigue chequeado.
        .addFileTypeValidator({
          fileType: 'application/pdf',
          skipMagicNumbersValidation: true,
        })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body() body: IngestFileBodyDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IngestResponseDto> {
    const text = await this.pdfExtractor.extractText(file.buffer);
    if (!text) {
      throw new BadRequestException(
        'No se pudo extraer texto del PDF. ¿Es un escaneo sin OCR?',
      );
    }

    return this.ingestService.ingest(
      {
        name: file.originalname,
        content: text,
        demoId: body.demoId,
      },
      tenantId,
    );
  }
}
