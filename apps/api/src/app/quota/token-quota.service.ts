// -----------------------------------------------------------------------------
// TokenQuotaService — rate limit por user/hora del consumo de tokens del LLM.
//
// Diseño:
//   - Una fila en TokenUsage por cada llamada al LLM (cualquier provider).
//   - El "límite" es por user: SUM(inputTokens + outputTokens) en la ventana
//     rolling de 1 hora previa al request actual.
//   - Si el rol es `superadmin` el guard hace bypass — Jorge y Edguitar
//     pueden probar sin trabarse.
//
// Por qué Postgres y no in-memory:
//   - Sobrevive al redeploy de Railway (los 20k tokens de hace 5 min
//     siguen contando aunque el container reinicie).
//   - Si en el futuro Railway escala a 2+ instancias, el counter sigue
//     siendo correcto.
//   - El costo es una INSERT por llamada al LLM y una SELECT por
//     pre-check, ambas con índice (userId, createdAt) — milisegundos.
// -----------------------------------------------------------------------------

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { prisma } from '@org/db';

/** Default cuando `TOKENS_PER_HOUR_PER_USER` no está en el env. */
export const DEFAULT_TOKENS_PER_HOUR_PER_USER = 20_000;

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Roles que el guard considera exentos del límite. */
const EXEMPT_ROLES: ReadonlySet<string> = new Set(['superadmin']);

/**
 * Excepción HTTP 429 con metadata útil para el frontend (tokens consumidos,
 * límite vigente, retry-after sugerido). El `AllExceptionsFilter` global la
 * serializa tal cual.
 */
export class QuotaExceededException extends HttpException {
  constructor(opts: {
    used: number;
    limit: number;
    retryAfterSeconds: number;
  }) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Quota Exceeded',
        message:
          `Alcanzaste el límite de ${opts.limit} tokens por hora. ` +
          `Has consumido ${opts.used}. Vuelve a intentar en ` +
          `${Math.ceil(opts.retryAfterSeconds / 60)} minutos.`,
        used: opts.used,
        limit: opts.limit,
        retryAfterSeconds: opts.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class TokenQuotaService {
  private readonly logger = new Logger(TokenQuotaService.name);

  /** Tope de tokens por user en la ventana rolling de 1h. */
  private readonly limitPerHour: number = this.readLimit();

  private readLimit(): number {
    const raw = process.env.TOKENS_PER_HOUR_PER_USER;
    if (!raw) return DEFAULT_TOKENS_PER_HOUR_PER_USER;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.logger.warn(
        `TOKENS_PER_HOUR_PER_USER inválido (${raw}). Uso default ${DEFAULT_TOKENS_PER_HOUR_PER_USER}.`,
      );
      return DEFAULT_TOKENS_PER_HOUR_PER_USER;
    }
    return parsed;
  }

  /** Tokens consumidos por el user en la última hora. */
  async getUsageInWindow(userId: string): Promise<number> {
    const since = new Date(Date.now() - ONE_HOUR_MS);
    const agg = await prisma.tokenUsage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    const input = agg._sum.inputTokens ?? 0;
    const output = agg._sum.outputTokens ?? 0;
    return input + output;
  }

  /**
   * Pre-check. Lanza `QuotaExceededException` (429) si el user excedió
   * el límite. Bypass para roles en `EXEMPT_ROLES`.
   *
   * Se llama al inicio de cada endpoint que dispara una llamada al LLM
   * (via guard o invocación directa del controller).
   */
  async assertWithinQuota(userId: string, role: string): Promise<void> {
    if (EXEMPT_ROLES.has(role)) return;
    const used = await this.getUsageInWindow(userId);
    if (used >= this.limitPerHour) {
      // Cuándo se libera el primer token de la ventana actual.
      const oldest = await prisma.tokenUsage.findFirst({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - ONE_HOUR_MS) },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const retryAfterMs = oldest
        ? Math.max(0, oldest.createdAt.getTime() + ONE_HOUR_MS - Date.now())
        : ONE_HOUR_MS;
      throw new QuotaExceededException({
        used,
        limit: this.limitPerHour,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      });
    }
  }

  /**
   * Post-record. Una fila por llamada — se llama después de que el LLM
   * respondió y conocemos input/output reales (o estimaciones cuando el
   * adapter no expone usage).
   *
   * `demoId` es opcional para soportar endpoints que no pertenecen a un
   * demo (ej. ingest/embeddings, si en el futuro se agregan al tracking).
   */
  async recordUsage(opts: {
    userId: string;
    tenantId: string;
    demoId?: string;
    inputTokens: number;
    outputTokens: number;
    provider: string;
  }): Promise<void> {
    await prisma.tokenUsage.create({
      data: {
        userId: opts.userId,
        tenantId: opts.tenantId,
        demoId: opts.demoId,
        inputTokens: Math.max(0, Math.floor(opts.inputTokens)),
        outputTokens: Math.max(0, Math.floor(opts.outputTokens)),
        provider: opts.provider,
      },
    });
  }

  /**
   * Convención de la industria: ~4 caracteres por token. Útil cuando el
   * adapter NO devuelve usage exacta (tool calling streams). Devuelve al
   * menos 1 token para no ocultar llamadas que sí pasaron.
   */
  static estimateTokensFromChars(chars: number): number {
    return Math.max(1, Math.ceil(chars / 4));
  }

  /**
   * Atajo cuando solo tenemos longitudes en caracteres (caso tool calling).
   * Aplica la fórmula `chars/4` y delega en `recordUsage`.
   */
  async recordEstimated(opts: {
    userId: string;
    tenantId: string;
    demoId?: string;
    inputChars: number;
    outputChars: number;
    provider: string;
  }): Promise<void> {
    await this.recordUsage({
      userId: opts.userId,
      tenantId: opts.tenantId,
      demoId: opts.demoId,
      inputTokens: TokenQuotaService.estimateTokensFromChars(opts.inputChars),
      outputTokens: TokenQuotaService.estimateTokensFromChars(opts.outputChars),
      provider: opts.provider,
    });
  }

  /** Para tests / introspección. */
  get limit(): number {
    return this.limitPerHour;
  }
}
