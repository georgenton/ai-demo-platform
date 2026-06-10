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
  MinLength,
  validateSync,
  ValidateIf,
} from 'class-validator';

export enum ChatProvider {
  anthropic = 'anthropic',
  openaiCompat = 'openai-compat',
  privateMac = 'private-mac',
  /**
   * Adapter determinístico sin LLM real (ver
   * `packages/llm-adapter/src/lib/providers/fake-chat.ts`). Usado en CI,
   * tests E2E y smoke tests locales donde no queremos depender de keys
   * cloud ni del túnel del Mac. No usar en prod.
   */
  fake = 'fake',
}

export enum EmbeddingsProvider {
  openai = 'openai',
  openaiCompat = 'openai-compat',
  privateMac = 'private-mac',
  /**
   * Análogo a `ChatProvider.fake`: el adapter genera vectores
   * determinísticos vía bag-of-words. Útil para arrancar el server en
   * smoke tests locales sin tener Mac/Cloudflare/OpenAI configurado.
   */
  fake = 'fake',
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

  // `private-mac` y `fake` no exigen CHAT_API_KEY/CHAT_MODEL en el env:
  //   - `private-mac` los lee de las PRIVATE_LLM_* (ver más abajo).
  //   - `fake` no llama a ningún LLM real — el adapter tiene defaults.
  @IsString()
  @ValidateIf(
    (o: EnvSchema) =>
      o.CHAT_PROVIDER !== ChatProvider.privateMac &&
      o.CHAT_PROVIDER !== ChatProvider.fake,
  )
  @IsNotEmpty()
  CHAT_API_KEY!: string;

  @IsString()
  @ValidateIf(
    (o: EnvSchema) =>
      o.CHAT_PROVIDER !== ChatProvider.privateMac &&
      o.CHAT_PROVIDER !== ChatProvider.fake,
  )
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

  @ValidateIf((o: EnvSchema) => o.CHAT_PROVIDER === ChatProvider.privateMac)
  @IsUrl(
    { require_tld: false, require_protocol: true },
    {
      message:
        'PRIVATE_LLM_BASE_URL es obligatoria con CHAT_PROVIDER=private-mac y debe ser una URL con protocolo.',
    },
  )
  PRIVATE_LLM_BASE_URL?: string;

  @ValidateIf((o: EnvSchema) => o.CHAT_PROVIDER === ChatProvider.privateMac)
  @IsString()
  @IsNotEmpty()
  PRIVATE_LLM_API_KEY?: string;

  @ValidateIf((o: EnvSchema) => o.CHAT_PROVIDER === ChatProvider.privateMac)
  @IsString()
  @IsNotEmpty()
  PRIVATE_LLM_MODEL?: string;

  @IsOptional()
  @IsString()
  PRIVATE_LLM_DEMO_NAME?: string;

  @IsOptional()
  @IsString()
  PRIVATE_LLM_TIMEOUT_MS?: string;

  // ---------------------------------------------------------------------------
  // Embeddings
  // ---------------------------------------------------------------------------

  @IsEnum(EmbeddingsProvider, {
    message: `EMBEDDINGS_PROVIDER debe ser uno de: ${Object.values(EmbeddingsProvider).join(', ')}`,
  })
  EMBEDDINGS_PROVIDER!: EmbeddingsProvider;

  // Mismo razonamiento que CHAT_API_KEY/MODEL: `private-mac` y `fake` no
  // exigen estas variables porque tienen fuentes alternativas o defaults.
  @IsString()
  @ValidateIf(
    (o: EnvSchema) =>
      o.EMBEDDINGS_PROVIDER !== EmbeddingsProvider.privateMac &&
      o.EMBEDDINGS_PROVIDER !== EmbeddingsProvider.fake,
  )
  @IsNotEmpty()
  EMBEDDINGS_API_KEY!: string;

  @IsString()
  @ValidateIf(
    (o: EnvSchema) =>
      o.EMBEDDINGS_PROVIDER !== EmbeddingsProvider.privateMac &&
      o.EMBEDDINGS_PROVIDER !== EmbeddingsProvider.fake,
  )
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

  @ValidateIf(
    (o: EnvSchema) => o.EMBEDDINGS_PROVIDER === EmbeddingsProvider.privateMac,
  )
  @IsString()
  @IsNotEmpty()
  PRIVATE_EMBEDDING_MODEL?: string;

  // ---------------------------------------------------------------------------
  // Server
  // ---------------------------------------------------------------------------

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  // ---------------------------------------------------------------------------
  // Auth (ADR-0014)
  // ---------------------------------------------------------------------------

  /**
   * Secreto para firmar los JWT. Mínimo 32 caracteres. Generar con
   * `openssl rand -base64 48`. Si se filtra, rotar inmediatamente
   * (invalida todos los tokens emitidos).
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(32, {
    message: 'JWT_SECRET debe tener al menos 32 caracteres por seguridad.',
  })
  JWT_SECRET!: string;

  /**
   * Duración del token expresada como string compatible con `ms`
   * (ej. '7d', '12h', '30m'). Default 7d.
   */
  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  /**
   * Dominio para la cookie en producción. En local se ignora — la cookie
   * se setea sin domain explícito. Ejemplo prod: '.nai-platform.com'.
   */
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  /**
   * Emails separados por coma cuyos users reciben role `superadmin` al
   * registrarse. Útil para bootstrappear el sistema. Ejemplo:
   * 'jorge@nai.local,edguitar@nai.local'.
   */
  @IsOptional()
  @IsString()
  SUPERADMIN_EMAILS?: string;

  // ---------------------------------------------------------------------------
  // Notarización (Demo 08, ADR-0019)
  // ---------------------------------------------------------------------------

  /**
   * Master key para cifrar las claves privadas RSA de los tenants en
   * reposo. AES-256-GCM. Debe ser hex de 64 chars (= 32 bytes = 256 bits).
   * Generar con `openssl rand -hex 32`.
   *
   * Si no está, el server arranca pero el demo 08 falla al primer anchor
   * local con mensaje claro. Para que el demo funcione en producción es
   * obligatoria.
   */
  @IsOptional()
  @IsString()
  @MinLength(64, { message: 'NOTARY_MASTER_KEY debe ser hex de 64 chars.' })
  NOTARY_MASTER_KEY?: string;

  /**
   * RPC endpoint de Polygon. Default Amoy testnet. Para producción real
   * apuntar a un RPC de mainnet (Alchemy, Infura, o el público de
   * Polygon).
   */
  @IsOptional()
  @IsString()
  POLYGON_RPC_URL?: string;

  /**
   * Private key de la wallet de demo para firmar las txs en Polygon. Debe
   * tener saldo POL (faucet en https://faucet.polygon.technology para
   * testnet). Si no está, el modo 'public' / 'both' falla al anchor con
   * mensaje claro — el modo 'local' sigue funcionando.
   *
   * NUNCA loguear este valor. NUNCA exponerlo al frontend.
   */
  @IsOptional()
  @IsString()
  POLYGON_WALLET_KEY?: string;

  /**
   * Slug de la red Polygon — 'polygon-amoy' (default) o 'polygon-mainnet'.
   * Se persiste en PublicAnchor.network para que el frontend arme el
   * link al explorer correcto.
   */
  @IsOptional()
  @IsString()
  POLYGON_NETWORK?: string;
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
      `Configuración inválida (revisa tu .env):\n${lines.join('\n')}`,
    );
  }
  return transformed;
}
