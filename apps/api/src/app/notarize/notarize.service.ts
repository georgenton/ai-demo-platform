// -----------------------------------------------------------------------------
// NotarizeService — orquesta el flujo de notarización del Demo 08.
//
// Flujo de `notarize(buffer, dto, tenantId, llmProvider)`:
//
//   1. Calcula contentHash SHA-256 del binario del PDF.
//   2. Extrae el texto del PDF (reusa PdfTextExtractor del IngestModule).
//   3. Crea el NotarizedDocument en BD con docType + tenantId + hash + texto.
//   4. Llama a los notaries activos según `mode`:
//        - 'local': LocalNotaryAdapter.
//        - 'public': PolygonNotaryAdapter.
//        - 'both': ambos en paralelo (Promise.allSettled — si uno falla
//          el otro sigue; el frontend ve un anchor 'failed' con razón).
//   5. Persiste LocalAnchor y/o PublicAnchor.
//   6. Dispara análisis IA con `analyzeDocument(docType, text)` — síncrono.
//   7. Persiste analysis JSON en el NotarizedDocument.
//   8. Devuelve NotarizeResponseDto con todo unido.
//
// Los notaries se construyen al boot del módulo (en notarize.module.ts) y
// se inyectan acá. Las env vars necesarias se validan en env.schema.ts.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { prisma } from '@org/db';
import type { ChatProvider } from '@org/llm-adapter';
import type {
  AnchorResult,
  NotaryAdapter,
  VerificationResult,
} from '@org/notary-adapter';

import { PdfTextExtractor } from '../ingest/pdf-text-extractor.js';

import { analyzeDocument } from './analyzers/analyze.js';
import type {
  AnchorSummary,
  DocumentAnalysis,
  NotarizedDocTypeDto,
  NotarizeMode,
  NotarizeResponseDto,
  VerificationResponseDto,
} from './dto/notarize.dto.js';

/**
 * Tokens DI para los notaries — uno por provider. Se registran en
 * NotarizeModule. Permite mockearlos en tests sin tocar la red ni la BD.
 */
export const LOCAL_NOTARY = Symbol('LocalNotaryAdapter');
export const POLYGON_NOTARY = Symbol('PolygonNotaryAdapter');

@Injectable()
export class NotarizeService {
  private readonly logger = new Logger(NotarizeService.name);

  /**
   * Network slug que se persiste en `PublicAnchor.network`. Cuando el
   * anchor falla (no llegamos a calcular details on-chain), igual lo
   * grabamos para auditoría con este slug — leyendo del config en vez
   * de hardcodear 'polygon-amoy' (hallazgo Codex sub-PR 4).
   */
  private readonly polygonNetwork: string;

  /**
   * Lista de secretos que el servicio NUNCA debe propagar en
   * `errorMessage` al frontend. Defense in depth contra cualquier
   * mensaje que el adapter por algún motivo no haya sanitizado.
   */
  private readonly secrets: ReadonlyArray<string>;

  constructor(
    private readonly pdfExtractor: PdfTextExtractor,
    @Inject(LOCAL_NOTARY) private readonly localNotary: NotaryAdapter,
    @Inject(POLYGON_NOTARY) private readonly polygonNotary: NotaryAdapter,
    private readonly config: ConfigService,
  ) {
    this.polygonNetwork =
      this.config.get<string>('POLYGON_NETWORK') ?? 'polygon-amoy';
    const secrets: string[] = [];
    const rpcUrl = this.config.get<string>('POLYGON_RPC_URL');
    const walletKey = this.config.get<string>('POLYGON_WALLET_KEY');
    const masterKey = this.config.get<string>('NOTARY_MASTER_KEY');
    if (rpcUrl) secrets.push(rpcUrl);
    if (walletKey) secrets.push(walletKey);
    if (masterKey) secrets.push(masterKey);
    this.secrets = secrets;
  }

  // -------------------------------------------------------------------------
  // notarize() — pipeline principal.
  // -------------------------------------------------------------------------

  async notarize(
    pdfBuffer: Buffer,
    input: {
      name: string;
      docType: NotarizedDocTypeDto;
      mode: NotarizeMode;
    },
    tenantId: string,
    llmProvider?: ChatProvider,
  ): Promise<NotarizeResponseDto> {
    this.logger.log(
      `Notarize start: tenant=${tenantId}, docType=${input.docType}, mode=${input.mode}, ` +
        `size=${pdfBuffer.length}B, llmProvider=${llmProvider ?? 'env default'}`,
    );

    // 1. Hash del binario — lo que se sella en la chain.
    const contentHash = sha256Hex(pdfBuffer);

    // 2. Texto para el LLM. El extractor lanza si el PDF no tiene texto
    //    (típico de escaneos sin OCR) — el endpoint del controller lo
    //    convierte en 400.
    const text = await this.pdfExtractor.extractText(pdfBuffer);
    if (!text || !text.trim()) {
      throw new NotFoundException(
        'No se pudo extraer texto del PDF. ¿Es un escaneo sin OCR?',
      );
    }

    // 3. Crear el Document. Si después algo falla (anchors o análisis), el
    //    Document queda persistido — el caller puede consultarlo y
    //    reintentar. Las relaciones a anchors/analysis se llenan en
    //    pasos sucesivos.
    const doc = await prisma.notarizedDocument.create({
      data: {
        tenantId,
        name: input.name,
        docType: input.docType,
        content: text,
        contentHash,
        contentSize: pdfBuffer.length,
      },
    });

    // 4 + 5. Notarizar según modo. allSettled para que un fallo en uno
    //         no aborte el otro — cada anchor reporta su estado.
    const anchors: AnchorSummary[] = [];
    const tasks: Array<Promise<AnchorSummary>> = [];
    if (input.mode === 'local' || input.mode === 'both') {
      tasks.push(this.runLocalAnchor(doc.id, tenantId, contentHash));
    }
    if (input.mode === 'public' || input.mode === 'both') {
      tasks.push(this.runPublicAnchor(doc.id, tenantId, contentHash));
    }
    const settled = await Promise.allSettled(tasks);
    for (const r of settled) {
      if (r.status === 'fulfilled') anchors.push(r.value);
      else {
        // Solo si ambos fallan vamos a tener una lista vacía; en ese caso
        // el frontend ve "ningún sello" y el reasoning del LLM no aplica.
        this.logger.error(
          `notarize anchor failed: ${(r.reason as Error).message}`,
        );
      }
    }

    // 6. Análisis IA. Si falla, persistimos analysis=null y devolvemos el
    //    doc igualmente — el user puede reintentar el análisis después.
    let analysis: DocumentAnalysis | null = null;
    try {
      analysis = await analyzeDocument(input.docType, text, llmProvider);
      await prisma.notarizedDocument.update({
        where: { id: doc.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { analysis: analysis as any },
      });
    } catch (err) {
      this.logger.warn(
        `notarize analysis failed (doc kept): ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `Notarize done: doc=${doc.id}, anchors=${anchors.length}, analysis=${analysis ? 'ok' : 'failed'}`,
    );

    return {
      documentId: doc.id,
      name: doc.name,
      docType: doc.docType,
      contentHash: doc.contentHash,
      contentSize: doc.contentSize,
      createdAt: doc.createdAt.toISOString(),
      analysis,
      anchors,
    };
  }

  // -------------------------------------------------------------------------
  // Wrappers de notarización — manejan el error → AnchorSummary failed.
  // -------------------------------------------------------------------------

  private async runLocalAnchor(
    documentId: string,
    tenantId: string,
    contentHash: string,
  ): Promise<AnchorSummary> {
    try {
      const result: AnchorResult = await this.localNotary.anchor({
        documentId,
        tenantId,
        contentHash,
      });
      // Persistencia del LocalAnchor la hace el adapter mismo (escribe
      // en la tabla `LocalAnchor`). Acá solo armamos el summary.
      return {
        provider: 'local',
        anchorId: result.anchorId,
        status: result.status,
        anchoredAt: result.anchoredAt.toISOString(),
      };
    } catch (err) {
      return {
        provider: 'local',
        anchorId: '',
        status: 'failed',
        anchoredAt: new Date().toISOString(),
        errorMessage: sanitizeErrorMessage(err, this.secrets),
      };
    }
  }

  private async runPublicAnchor(
    documentId: string,
    tenantId: string,
    contentHash: string,
  ): Promise<AnchorSummary> {
    try {
      const result: AnchorResult = await this.polygonNotary.anchor({
        documentId,
        tenantId,
        contentHash,
      });
      // Persistir PublicAnchor en BD (a diferencia del local, el adapter
      // Polygon NO toca BD — devuelve el txHash y nosotros lo guardamos).
      const details = result.details as {
        network: string;
        txHash: string;
        blockNumber: number | null;
        explorerUrl?: string;
      };
      await prisma.publicAnchor.create({
        data: {
          documentId,
          tenantId,
          network: details.network,
          txHash: details.txHash,
          blockNumber:
            details.blockNumber != null ? BigInt(details.blockNumber) : null,
          anchoredHash: contentHash,
          status: result.status === 'confirmed' ? 'confirmed' : 'pending',
          confirmedAt: result.status === 'confirmed' ? new Date() : null,
        },
      });
      return {
        provider: 'polygon',
        anchorId: details.txHash,
        status: result.status,
        anchoredAt: result.anchoredAt.toISOString(),
        explorerUrl: details.explorerUrl ?? '',
      };
    } catch (err) {
      // Persistimos la falla para auditoría — un PublicAnchor con
      // status='failed' es útil para reintentos posteriores. Sanitizamos
      // el mensaje antes de persistir Y antes de devolverlo al frontend
      // (defense in depth contra leaks).
      const errMsg = sanitizeErrorMessage(err, this.secrets, 500);
      try {
        await prisma.publicAnchor.create({
          data: {
            documentId,
            tenantId,
            network: this.polygonNetwork,
            anchoredHash: contentHash,
            status: 'failed',
            errorMessage: errMsg,
          },
        });
      } catch (persistErr) {
        this.logger.warn(
          `failed to persist failed PublicAnchor: ${(persistErr as Error).message}`,
        );
      }
      return {
        provider: 'polygon',
        anchorId: '',
        status: 'failed',
        anchoredAt: new Date().toISOString(),
        errorMessage: errMsg.slice(0, 200),
      };
    }
  }

  // -------------------------------------------------------------------------
  // findById + list — consulta multi-tenant.
  // -------------------------------------------------------------------------

  async findById(
    documentId: string,
    tenantId: string,
  ): Promise<NotarizeResponseDto> {
    const doc = await prisma.notarizedDocument.findFirst({
      where: { id: documentId, tenantId },
      include: {
        localAnchor: true,
        publicAnchors: { orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }

    const anchors: AnchorSummary[] = [];
    if (doc.localAnchor) {
      anchors.push({
        provider: 'local',
        anchorId: doc.localAnchor.id,
        status: 'confirmed',
        anchoredAt: doc.localAnchor.createdAt.toISOString(),
      });
    }
    for (const p of doc.publicAnchors) {
      anchors.push({
        provider: 'polygon',
        anchorId: p.txHash ?? '',
        status: p.status,
        anchoredAt: p.requestedAt.toISOString(),
        explorerUrl: explorerUrlFor(p.network, p.txHash),
        errorMessage: p.errorMessage ?? undefined,
      });
    }

    return {
      documentId: doc.id,
      name: doc.name,
      docType: doc.docType,
      contentHash: doc.contentHash,
      contentSize: doc.contentSize,
      createdAt: doc.createdAt.toISOString(),
      analysis: (doc.analysis as DocumentAnalysis | null) ?? null,
      anchors,
    };
  }

  async list(tenantId: string): Promise<NotarizeResponseDto[]> {
    const docs = await prisma.notarizedDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        localAnchor: true,
        publicAnchors: { orderBy: { requestedAt: 'desc' } },
      },
    });
    return docs.map((doc) => {
      const anchors: AnchorSummary[] = [];
      if (doc.localAnchor) {
        anchors.push({
          provider: 'local',
          anchorId: doc.localAnchor.id,
          status: 'confirmed',
          anchoredAt: doc.localAnchor.createdAt.toISOString(),
        });
      }
      for (const p of doc.publicAnchors) {
        anchors.push({
          provider: 'polygon',
          anchorId: p.txHash ?? '',
          status: p.status,
          anchoredAt: p.requestedAt.toISOString(),
          explorerUrl: explorerUrlFor(p.network, p.txHash),
          errorMessage: p.errorMessage ?? undefined,
        });
      }
      return {
        documentId: doc.id,
        name: doc.name,
        docType: doc.docType,
        contentHash: doc.contentHash,
        contentSize: doc.contentSize,
        createdAt: doc.createdAt.toISOString(),
        analysis: (doc.analysis as DocumentAnalysis | null) ?? null,
        anchors,
      };
    });
  }

  // -------------------------------------------------------------------------
  // verify() — re-chequea los anchors contra los providers.
  // -------------------------------------------------------------------------

  async verify(
    documentId: string,
    tenantId: string,
  ): Promise<VerificationResponseDto> {
    const doc = await prisma.notarizedDocument.findFirst({
      where: { id: documentId, tenantId },
      include: {
        localAnchor: true,
        publicAnchors: { orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }

    const results: VerificationResponseDto['anchors'] = [];
    if (doc.localAnchor) {
      const v: VerificationResult = await this.localNotary.verify(
        doc.localAnchor.id,
        doc.contentHash,
      );
      results.push({
        provider: 'local',
        anchorId: doc.localAnchor.id,
        valid: v.valid,
        reason: v.reason,
        details: v.details,
      });
    }
    for (const p of doc.publicAnchors) {
      if (!p.txHash) continue;
      const v: VerificationResult = await this.polygonNotary.verify(
        p.txHash,
        doc.contentHash,
      );
      results.push({
        provider: 'polygon',
        anchorId: p.txHash,
        valid: v.valid,
        reason: v.reason,
        details: v.details,
      });
    }

    return { documentId: doc.id, anchors: results };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function explorerUrlFor(network: string, txHash: string | null): string {
  if (!txHash) return '';
  if (network === 'polygon-amoy')
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (network === 'polygon-mainnet')
    return `https://polygonscan.com/tx/${txHash}`;
  return '';
}

/**
 * Sanitiza un mensaje de error antes de propagarlo al frontend en
 * `AnchorSummary.errorMessage`. Defense in depth — el PolygonNotaryAdapter
 * ya redacta secretos, pero los errores del LocalNotaryAdapter pasan
 * derecho, y siempre puede aparecer un error de capa intermedia (ethers,
 * prisma) que no sanitizó nadie.
 *
 * Estrategia (espejo de sanitizeError en polygon-notary):
 *   1. Reemplaza los `secrets` literales por [REDACTED].
 *   2. Redacta patrones genéricos: URLs http(s)/wss, wallet keys hex de
 *      64 chars, addresses 0x... de 40 chars.
 *   3. Trunca a `maxChars` (default 200).
 */
export function sanitizeErrorMessage(
  err: unknown,
  secrets: ReadonlyArray<string>,
  maxChars = 200,
): string {
  let msg: string;
  if (typeof err === 'string') msg = err;
  else if (err instanceof Error) msg = err.message;
  else return 'error desconocido';

  for (const s of secrets) {
    if (!s) continue;
    msg = msg.split(s).join('[REDACTED]');
  }

  const patterns: RegExp[] = [
    /0x[0-9a-fA-F]{64}/g, // wallet private keys con prefix
    /\b[0-9a-fA-F]{64}\b/g, // wallet keys sin prefix
    /https?:\/\/[^\s"'<>)]+/gi, // URLs http(s)
    /wss?:\/\/[^\s"'<>)]+/gi, // URLs ws(s)
    /0x[0-9a-fA-F]{40}\b/g, // ethereum addresses
  ];
  for (const p of patterns) {
    msg = msg.replace(p, '[REDACTED]');
  }

  msg = msg.slice(0, maxChars).trim();
  if (!msg || /^(\[REDACTED\]\s*)+$/.test(msg)) return 'error sanitizado';
  return msg;
}
