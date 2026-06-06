// -----------------------------------------------------------------------------
// CompareService — orquesta el flujo del comparador (Demo 02):
//   1) Trae los documentos por ID desde la DB.
//   2) Verifica que existan TODOS los IDs pedidos (404 si falta alguno).
//   3) Trunca cada contenido a un tope individual (defensa contra prompts
//      gigantes que disparen costo o excedan el context window).
//   4) Arma el prompt comparativo (ComparePromptBuilder).
//   5) Stremea la respuesta del LLM token por token.
//
// Devuelve un AsyncIterable<string> — el controller lo bridgea a Observable
// para el @Sse() (mismo patrón que ChatService).
//
// `prisma` se importa directo de @org/db (mismo criterio que en
// IngestService/ChatService): es un singleton; mockearlo via vi.mock cubre
// los tests sin sumar ceremonia de DI.
// -----------------------------------------------------------------------------

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';
import type { ChatProvider } from '@org/llm-adapter';

import {
  ComparePromptBuilder,
  type CompareDocument,
} from './compare-prompt-builder.js';
import type { CompareRequestDto } from './dto/compare.dto.js';

/**
 * Tope por documento, en caracteres. Estimado pragmático: ~30K chars ≈
 * 8K tokens; con 5 documentos en el límite quedan ~40K tokens de contexto,
 * holgado para Claude (200K) y manejable para modelos OpenAI-compatibles
 * más chicos cuando entre NAI. Si en producción aparecen contratos más
 * grandes, vamos a snippeting por chunks (RAG sobre el comparador).
 */
const MAX_CHARS_PER_DOCUMENT = 30_000;

@Injectable()
export class CompareService {
  private readonly logger = new Logger(CompareService.name);

  constructor(private readonly promptBuilder: ComparePromptBuilder) {}

  async *streamCompare(
    request: CompareRequestDto,
    tenantId: string,
    llmProvider?: ChatProvider,
  ): AsyncIterable<string> {
    this.logger.log(
      `Compare ${request.documentIds.length} documents across ${request.dimensions.length} dimensions (tenant=${tenantId})`,
    );

    // 1) Fetch. Filtramos por tenantId — si un user pide IDs de otro tenant,
    //    no aparecen y caemos en el 404 del paso 2 (sin filtrar existencia).
    // orderBy createdAt asc para que dos llamadas con los mismos IDs den
    // el mismo orden de columnas en la respuesta (determinismo).
    const docs = await prisma.document.findMany({
      where: { id: { in: request.documentIds }, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    // 2) Validar que aparezcan todos. Si falta uno, 404 con el detalle de
    //    cuál — más útil que un 404 genérico.
    if (docs.length !== request.documentIds.length) {
      const found = new Set(docs.map((d) => d.id));
      const missing = request.documentIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Documentos no encontrados: ${missing.join(', ')}`,
      );
    }

    // 3) Truncar. La política está aislada en una función para que sea
    //    obvio dónde aparece la decisión y fácil de cambiar.
    const documents = docs.map((d): CompareDocument => {
      const truncated = d.content.length > MAX_CHARS_PER_DOCUMENT;
      return {
        id: d.id,
        name: d.name,
        content: truncated
          ? d.content.slice(0, MAX_CHARS_PER_DOCUMENT)
          : d.content,
        truncated,
      };
    });

    const anyTruncated = documents.some((d) => d.truncated);
    if (anyTruncated) {
      this.logger.warn(
        `Some documents exceeded ${MAX_CHARS_PER_DOCUMENT} chars and were truncated`,
      );
    }

    // 4) Prompt + 5) stream — yield* delega al AsyncIterable del adapter
    //    sin envolverlo (cero overhead, igual que en ChatService).
    const messages = this.promptBuilder.build({
      documents,
      dimensions: request.dimensions,
    });

    yield* chat.completeStream(messages, { provider: llmProvider });
  }
}
