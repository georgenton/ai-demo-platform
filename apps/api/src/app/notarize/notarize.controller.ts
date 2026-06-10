// -----------------------------------------------------------------------------
// HTTP layer del Demo 08 — notarización cooperativa.
//
// Endpoints:
//   POST   /api/v1/notarize         — subir PDF + notarizar + analizar
//   GET    /api/v1/notarize         — listar documentos del tenant (top 50)
//   GET    /api/v1/notarize/:id     — detalle (incluye anchors + análisis)
//   GET    /api/v1/notarize/:id/verify — re-verificar anchors contra providers
//
// Gating:
//   - `@RequireDemo('notarize')` rechaza tenants sin el demo habilitado.
//   - `@CurrentTenant()` inyecta el tenantId del JWT.
//   - `@CurrentLlmProvider()` propaga el dropdown del header al analyzer.
// -----------------------------------------------------------------------------

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
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

import type { ChatProvider } from '@org/llm-adapter';

import {
  CurrentLlmProvider,
  CurrentTenant,
} from '../auth/current-user.decorator.js';
import { RequireDemo } from '../auth/require-demo.decorator.js';

import {
  NotarizeResponseDto,
  NotarizeUploadBodyDto,
  VerificationResponseDto,
} from './dto/notarize.dto.js';
import { NotarizeService } from './notarize.service.js';

/** 10 MB. Coherente con el límite del IngestController. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

@ApiTags('Notarize (Demo 08)')
@Controller({ path: 'notarize' })
@RequireDemo('notarize')
export class NotarizeController {
  constructor(private readonly notarize: NotarizeService) {}

  // ---------------------------------------------------------------------------
  // POST /api/v1/notarize — upload + notarize + analyze
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Sube un PDF cooperativo, lo notariza y lo analiza con IA',
    description:
      'Multipart con `file` (PDF) + `docType` (assembly_minutes | loan | capital_contribution) + `mode` (local | public | both). ' +
      'Devuelve documentId + análisis IA + 1-2 anchors según el modo elegido.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'docType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: {
          type: 'string',
          enum: ['assembly_minutes', 'loan', 'capital_contribution'],
        },
        mode: { type: 'string', enum: ['local', 'public', 'both'] },
      },
    },
  })
  @ApiResponse({ status: 201, type: NotarizeResponseDto })
  @ApiResponse({ status: 400, description: 'PDF sin texto o body inválido.' })
  @ApiResponse({ status: 422, description: 'PDF > 10MB o mime != pdf.' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_PDF_BYTES })
        // Mismo motivo que IngestController: PDFs no estándar (bioRxiv,
        // medRxiv, generadores de cooperativas) pueden no pasar el magic
        // number check; el MIME del cliente sigue chequeado.
        .addFileTypeValidator({
          fileType: 'application/pdf',
          skipMagicNumbersValidation: true,
        })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body() body: NotarizeUploadBodyDto,
    @CurrentTenant() tenantId: string,
    @CurrentLlmProvider() llmProvider: ChatProvider | undefined,
  ): Promise<NotarizeResponseDto> {
    // tenantId puede venir undefined si el JWT no traía tid — en multi-tenant
    // sería un bug del guard. Lanzamos 400 explícito en lugar de dejar que
    // el service crashee con un mensaje confuso.
    if (!tenantId) {
      throw new BadRequestException('Tenant no resuelto en la sesión.');
    }
    return this.notarize.notarize(
      file.buffer,
      {
        name: file.originalname,
        docType: body.docType,
        mode: body.mode ?? 'both',
      },
      tenantId,
      llmProvider,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/notarize — listado
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Listar documentos notarizados del tenant' })
  @ApiResponse({ status: 200, type: NotarizeResponseDto, isArray: true })
  async list(
    @CurrentTenant() tenantId: string,
  ): Promise<NotarizeResponseDto[]> {
    return this.notarize.list(tenantId);
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/notarize/:id — detalle
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un documento notarizado' })
  @ApiResponse({ status: 200, type: NotarizeResponseDto })
  @ApiResponse({ status: 404, description: 'Documento no encontrado' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<NotarizeResponseDto> {
    return this.notarize.findById(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/notarize/:id/verify — re-verificar
  // ---------------------------------------------------------------------------

  @Get(':id/verify')
  @ApiOperation({
    summary: 'Re-verifica los anchors contra sus providers',
    description:
      'Para local: recalcula hash + verifica firma. Para polygon: lee la tx on-chain y verifica que el data matchea el contentHash.',
  })
  @ApiResponse({ status: 200, type: VerificationResponseDto })
  async verify(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<VerificationResponseDto> {
    return this.notarize.verify(id, tenantId);
  }
}
