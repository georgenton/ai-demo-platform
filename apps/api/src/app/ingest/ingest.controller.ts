// HTTP layer del /api/v1/ingest.
// El versionado URI lo configura main.ts (defaultVersion: '1'), así que este
// controller no necesita decir explícitamente `version: '1'`.

import { Body, Controller, Post } from '@nestjs/common';

import { IngestRequestDto, IngestResponseDto } from './dto/ingest.dto.js';
import { IngestService } from './ingest.service.js';

@Controller({ path: 'ingest' })
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  /**
   * POST /api/v1/ingest
   *
   * Body (JSON):
   *   { name: string, content: string, demoId: string }
   *
   * Responde 201 con { documentId, chunkCount } cuando el documento se
   * indexó correctamente. 400 si el body no valida o el contenido no
   * produjo chunks.
   */
  @Post()
  async ingest(@Body() dto: IngestRequestDto): Promise<IngestResponseDto> {
    return this.ingestService.ingest(dto);
  }
}
