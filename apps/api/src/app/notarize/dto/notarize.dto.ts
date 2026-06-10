// -----------------------------------------------------------------------------
// DTOs del NotarizeModule (Demo 08).
//
// Reflejan el modelo de dominio del ADR-0019:
//   - Tres tipos de documento (acta, préstamo, aporte de capital).
//   - Tres modos de notarización (interno, público, ambos).
//
// El frontend manda el PDF como multipart + estos campos como form fields.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Tipo de documento cooperativo. Espejo del enum `NotarizedDocType` del
 * schema Prisma. Cada uno dispara un analyzer LLM distinto (ver
 * `analyzers/`).
 *
 * Los valores son los slugs internos. La UI los traduce con i18n.
 */
export const NOTARIZED_DOC_TYPES = [
  'assembly_minutes',
  'loan',
  'capital_contribution',
] as const;
export type NotarizedDocTypeDto = (typeof NOTARIZED_DOC_TYPES)[number];

/**
 * Modo de notarización elegido por el usuario al subir el PDF.
 *   - `local`:  solo mini-ledger interno (rápido, sin red, sin gas).
 *   - `public`: solo anchor on-chain en Polygon (visible por terceros).
 *   - `both`:   ambos (default recomendado en el demo).
 */
export const NOTARIZE_MODES = ['local', 'public', 'both'] as const;
export type NotarizeMode = (typeof NOTARIZE_MODES)[number];

export class NotarizeUploadBodyDto {
  @ApiProperty({
    enum: NOTARIZED_DOC_TYPES,
    description: 'Tipo de documento cooperativo — define el analyzer LLM.',
  })
  @IsEnum(NOTARIZED_DOC_TYPES, {
    message: `docType debe ser uno de: ${NOTARIZED_DOC_TYPES.join(', ')}`,
  })
  docType!: NotarizedDocTypeDto;

  @ApiProperty({
    enum: NOTARIZE_MODES,
    required: false,
    default: 'both',
    description: 'Modo de notarización. Default both.',
  })
  @IsOptional()
  @IsEnum(NOTARIZE_MODES)
  mode?: NotarizeMode;
}

// ---------------------------------------------------------------------------
// Tipos de respuesta — el frontend los consume.
// ---------------------------------------------------------------------------

export interface AnchorSummary {
  /** Provider: 'local' o 'polygon'. */
  provider: 'local' | 'polygon';
  /** ID/hash del anchor. Para local es el id de la row; para polygon es el txHash. */
  anchorId: string;
  /** Estado: 'confirmed' o 'pending'. */
  status: 'confirmed' | 'pending' | 'failed';
  /** Cuándo se aceptó. */
  anchoredAt: string;
  /** URL al explorer público (solo polygon). String vacío si no aplica. */
  explorerUrl?: string;
  /** Mensaje de error si status='failed'. */
  errorMessage?: string;
}

/**
 * Forma del análisis IA por tipo de documento. Cada analyzer (ver
 * `analyzers/`) llena este shape con sus dimensiones específicas. El
 * frontend lo renderiza como tabla.
 */
export interface DocumentAnalysis {
  /** Tipo de documento — para que el frontend elija el template visual. */
  docType: NotarizedDocTypeDto;
  /**
   * Dimensiones extraídas del documento. La lista varía por docType (ver
   * ADR-0019). Cada item tiene `key` + `label` + `value` para ser
   * agnostic en la UI.
   */
  dimensions: Array<{
    /** Slug interno estable (ej. `quorum_required`). */
    key: string;
    /** Etiqueta humana en español. */
    label: string;
    /** Valor extraído por el LLM. Puede ser string libre. */
    value: string;
  }>;
  /**
   * Riesgos detectados con severidad. Cada item se muestra como chip.
   */
  risks: Array<{
    severity: 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
  }>;
  /**
   * Recomendaciones libres del LLM al usuario.
   */
  recommendations: string[];
  /**
   * Razonamiento corto del LLM. Útil para que el operador entienda el
   * "por qué" detrás del resultado.
   */
  reasoning?: string;
}

export class NotarizeResponseDto {
  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: NOTARIZED_DOC_TYPES })
  docType!: NotarizedDocTypeDto;

  /** SHA-256 hex del binario del PDF. */
  @ApiProperty()
  contentHash!: string;

  @ApiProperty()
  contentSize!: number;

  @ApiProperty()
  createdAt!: string;

  /** Análisis IA. Null mientras está procesando (raro — sub-PR 4 lo dispara síncronamente). */
  @ApiProperty({ type: Object, required: false })
  analysis!: DocumentAnalysis | null;

  /** Anchors generados — uno o dos según `mode`. */
  @ApiProperty({ type: Object, isArray: true })
  anchors!: AnchorSummary[];
}

/**
 * Resultado de re-verificar un documento — recalcula el hash + chequea los
 * anchors contra el provider. Útil para "este PDF de hoy es el mismo que
 * me notarizaron hace 6 meses?".
 */
export class VerificationResponseDto {
  @ApiProperty()
  documentId!: string;

  @ApiProperty({ type: Object, isArray: true })
  anchors!: Array<{
    provider: 'local' | 'polygon';
    anchorId: string;
    valid: boolean;
    reason?: string;
    details: Record<string, unknown>;
  }>;
}
