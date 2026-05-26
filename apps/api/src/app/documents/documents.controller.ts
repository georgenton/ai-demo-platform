// HTTP layer del módulo Documents.
//
// Cuatro endpoints:
//   - GET /api/v1/documents              → lista paginada (filtro por demoId)
//   - GET /api/v1/documents/:id          → detalle (content completo)
//   - GET /api/v1/documents/:id/chunks   → chunks (debug del RAG)
//   - DELETE /api/v1/documents/:id       → borra (cascade chunks)

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DocumentsService } from './documents.service.js';
import {
  ChunkSummary,
  DocumentDetail,
  ListDocumentsResponse,
} from './dto/document.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';

@ApiTags('Documents')
@Controller({ path: 'documents' })
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos (paginado, filtro por demoId)' })
  @ApiResponse({ status: 200, type: ListDocumentsResponse })
  list(@Query() query: ListDocumentsQueryDto): Promise<ListDocumentsResponse> {
    return this.documents.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un documento (incluye content completo)',
  })
  @ApiResponse({ status: 200, type: DocumentDetail })
  @ApiResponse({ status: 404, description: 'Documento no existe' })
  detail(@Param('id') id: string): Promise<DocumentDetail> {
    return this.documents.findOne(id);
  }

  @Get(':id/chunks')
  @ApiOperation({
    summary: 'Chunks de un documento (debug del RAG, sin embeddings)',
  })
  @ApiResponse({ status: 200, type: [ChunkSummary] })
  @ApiResponse({ status: 404, description: 'Documento no existe' })
  chunks(@Param('id') id: string): Promise<ChunkSummary[]> {
    return this.documents.findChunks(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar un documento (cascade elimina chunks)' })
  @ApiResponse({ status: 204, description: 'Borrado exitoso, sin body.' })
  @ApiResponse({ status: 404, description: 'Documento no existe' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.documents.remove(id);
  }
}
