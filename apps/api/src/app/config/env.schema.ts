// -----------------------------------------------------------------------------
// Schema de validación de variables de entorno.
//
// Se valida al arrancar el server vía @nestjs/config + class-validator. Si
// falta una key obligatoria o un valor es inválido, NestFactory.create()
// lanza con mensaje claro — el server no levanta. Eso evita 500s confusos
// más tarde cuando el primer request del cliente toque un módulo que las
// usa lazy.
//
// Variables agrupadas por concern:
//   - DATABASE_URL                                  → Postgres (Prisma)
//   - CHAT_PROVIDER + CHAT_API_KEY + CHAT_MODEL    → LLM chat (ADR-0009)
//   - CHAT_BASE_URL                                → opcional; obligatoria solo con openai-compat
//   - EMBEDDINGS_PROVIDER + EMBEDDINGS_API_KEY +
//     EMBEDDINGS_MODEL                             → embeddings
//   - EMBEDDINGS_BASE_URL                          → opcional; obligatoria solo con openai-compat
//   - PORT                                          → opcional, default 3000
// -----------------------------------------------------------------------------

// `reflect-metadata` debe estar cargado antes de que se evalúen los decoradores
// de class-validator/class-transformer. NestJS lo carga al boot (vía sus
// imports internos); para tests directos de este validador necesitamos
// pedirlo explícito.
import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
  ValidateIf,
} from 'class-validator';

export enum ChatProvider {
  anthropic = 'anthropic',
  openaiCompat = 'openai-compat',
}

export enum EmbeddingsProvider {
  openai = 'openai',
  openaiCompat = 'openai-compat',
}

/**
 * Forma esperada del `process.env` después de cargar `.env`. Las validaciones
 * son de presencia + sanidad de tipos; no chequeamos que la API key sea
 * válida en el provider (eso lo descubrimos en el primer call).
 */
export class EnvSchema {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  @IsEnum(ChatProvider, {
    message: `CHAT_PROVIDER debe ser uno de: ${Object.values(ChatProvider).join(', ')}`,
  })
  CHAT_PROVIDER!: ChatProvider;

  @IsString()
  @IsNotEmpty()
  CHAT_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  CHAT_MODEL!: string;

  /**
   * Obligatoria SOLO con provider=openai-compat (ej: NAI). ValidateIf hace
   * que la validación se aplique solo cuando la condición se cumple — sin
   * `@IsOptional()` (que sobrescribiría el chequeo).
   */
  @ValidateIf((o: EnvSchema) => o.CHAT_PROVIDER === ChatProvider.openaiCompat)
  @IsUrl(
    { require_tld: false, require_protocol: true },
    {
      message:
        'CHAT_BASE_URL es obligatoria con CHAT_PROVIDER=openai-compat y debe ser una URL con protocolo.',
    },
  )
  CHAT_BASE_URL?: string;

  // ---------------------------------------------------------------------------
  // Embeddings
  // ---------------------------------------------------------------------------

  @IsEnum(EmbeddingsProvider, {
    message: `EMBEDDINGS_PROVIDER debe ser uno de: ${Object.values(EmbeddingsProvider).join(', ')}`,
  })
  EMBEDDINGS_PROVIDER!: EmbeddingsProvider;

  @IsString()
  @IsNotEmpty()
  EMBEDDINGS_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  EMBEDDINGS_MODEL!: string;

  @ValidateIf(
    (o: EnvSchema) => o.EMBEDDINGS_PROVIDER === EmbeddingsProvider.openaiCompat,
  )
  @IsUrl(
    { require_tld: false, require_protocol: true },
    {
      message:
        'EMBEDDINGS_BASE_URL es obligatoria con EMBEDDINGS_PROVIDER=openai-compat y debe ser una URL con protocolo.',
    },
  )
  EMBEDDINGS_BASE_URL?: string;

  // ---------------------------------------------------------------------------
  // Server
  // ---------------------------------------------------------------------------

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;
}

/**
 * Función que @nestjs/config llama con `process.env`. Si falla, lanza un
 * Error con el detalle de los campos inválidos, lo que aborta el bootstrap.
 *
 * Aceptamos un `Record<string, unknown>` y devolvemos el mismo objeto
 * (el ConfigModule lo usa para resolver `config.get(...)` después).
 */
export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const transformed = plainToInstance(EnvSchema, raw, {
    enableImplicitConversion: true, // PORT puede llegar como string desde process.env
  });
  const errors = validateSync(transformed, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    const lines = errors.flatMap((e) =>
      Object.values(e.constraints ?? {}).map((c) => `  - ${e.property}: ${c}`),
    );
    throw new Error(
      `Configuración inválida (revisá tu .env):\n${lines.join('\n')}`,
    );
  }
  return transformed;
}
