// -----------------------------------------------------------------------------
// DocumentsService — capa de lectura/borrado sobre la tabla Document.
//
// Tres responsabilidades:
//   - findAll(filters, pagination): lista paginada con conteo total.
//   - findOne(id): detalle de un documento (con su `content` completo).
//   - findChunks(documentId): chunks del documento, sin el embedding.
//   - remove(id): borra el doc (CASCADE elimina los chunks).
//
// 404 vs 200 con null: usamos NotFoundException en todos los GET/:id y
// DELETE — el endpoint promete "el recurso existe" y si no, 404 con
// mensaje claro. Es la misma convención que ya usamos en DemosController.
// -----------------------------------------------------------------------------

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { prisma } from '@org/db';

import type {
  ChunkSummary,
  DocumentDetail,
  DocumentSummary,
  ListDocumentsResponse,
} from './dto/document.dto.js';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';

/** Defaults aplicados cuando el query string no los trae. */
const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  /**
   * Lista documentos paginados. Hacemos dos queries en paralelo (el listado
   * con limit/offset + el count del total filtrado), envueltas en un
   * Promise.all para reducir round-trips a la DB.
   */
  async findAll(
    query: ListDocumentsQueryDto,
    tenantId: string,
  ): Promise<ListDocumentsResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? DEFAULT_OFFSET;
    // Filtro siempre por tenantId. demoId es opcional y se acumula.
    const where = {
      tenantId,
      ...(query.demoId ? { demoId: query.demoId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          // _count.chunks es más barato que traer todos los chunks. Prisma
          // emite un subquery SELECT COUNT(*) que aprovecha el índice de FK.
          _count: { select: { chunks: true } },
        },
      }),
      prisma.document.count({ where }),
    ]);

    const items: DocumentSummary[] = rows.map((d) => ({
      id: d.id,
      name: d.name,
      demoId: d.demoId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      chunkCount: d._count.chunks,
    }));

    return { items, total, limit, offset };
  }

  /**
   * Detalle de un documento con su content completo. 404 si no existe O si
   * existe pero pertenece a otro tenant. Mismo mensaje para no filtrar
   * existencia entre tenants.
   */
  async findOne(id: string, tenantId: string): Promise<DocumentDetail> {
    const doc = await prisma.document.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { chunks: true } } },
    });
    if (!doc) {
      throw new NotFoundException(`Documento "${id}" no existe`);
    }
    return {
      id: doc.id,
      name: doc.name,
      content: doc.content,
      demoId: doc.demoId,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      chunkCount: doc._count.chunks,
    };
  }

  /**
   * Lista los chunks de un documento. NO incluye el embedding vector (es
   * Unsupported en Prisma + ruido para la UI). Si el documento no existe,
   * 404 — para que el cliente distinga "doc inexistente" de "doc sin chunks".
   */
  async findChunks(
    documentId: string,
    tenantId: string,
  ): Promise<ChunkSummary[]> {
    const docExists = await prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true },
    });
    if (!docExists) {
      throw new NotFoundException(`Documento "${documentId}" no existe`);
    }

    const chunks = await prisma.chunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
      select: { id: true, index: true, content: true },
    });
    return chunks;
  }

  /**
   * Borra un documento. CASCADE en el FK borra los chunks asociados — el
   * schema ya lo declara con `onDelete: Cascade`. 404 si el ID no existe
   * (en vez de éxito silencioso, que ocultaría typos del cliente).
   */
  async remove(id: string, tenantId: string): Promise<void> {
    const exists = await prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Documento "${id}" no existe`);
    }

    await prisma.document.delete({ where: { id } });
    this.logger.log(`Deleted document ${id} (tenant=${tenantId})`);
  }
}
