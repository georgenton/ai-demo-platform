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

import { DocumentsService } from './documents.service.js';
import type {
  ChunkSummary,
  DocumentDetail,
  ListDocumentsResponse,
} from './dto/document.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';

@Controller({ path: 'documents' })
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** GET /api/v1/documents */
  @Get()
  list(@Query() query: ListDocumentsQueryDto): Promise<ListDocumentsResponse> {
    return this.documents.findAll(query);
  }

  /** GET /api/v1/documents/:id */
  @Get(':id')
  detail(@Param('id') id: string): Promise<DocumentDetail> {
    return this.documents.findOne(id);
  }

  /**
   * GET /api/v1/documents/:id/chunks
   *
   * Devuelve los chunks del documento ordenados por `index`. Útil para
   * inspección manual del RAG (entender por qué el chat respondió X o no
   * encontró Y).
   */
  @Get(':id/chunks')
  chunks(@Param('id') id: string): Promise<ChunkSummary[]> {
    return this.documents.findChunks(id);
  }

  /**
   * DELETE /api/v1/documents/:id
   *
   * Convención REST: 204 No Content cuando se borra exitosamente, sin body.
   * Si el id no existe, el service lanza NotFoundException (404).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.documents.remove(id);
  }
}
