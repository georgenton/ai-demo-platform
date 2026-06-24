// -----------------------------------------------------------------------------
// UpdateTenantDto — body del PATCH /api/v1/admin/tenant.
//
// Todos los campos son opcionales: el admin puede mandar solo lo que cambia.
// El backend hace merge no destructivo (solo escribe los campos presentes).
//
// Validaciones:
//   - displayName: 1..200 chars (cabe en el header de cualquier UI razonable).
//   - enabledDemos: array de strings; cada uno debe estar en el catálogo
//     (rag/comparator/corpus/agent/tutor). El registry final lo valida.
//   - branding: objeto JSON con shape opcional { logoUrl, accentColor,
//     displayName }. accentColor debe ser hex válido (#RRGGBB).
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * Set de providers que el admin puede elegir desde la UI. Espejo de
 * `ChatProvider` del adapter menos `fake` (`fake` es solo para CI/tests, no
 * tiene sentido exponerlo en /admin/tenant). El valor `null` lo aceptamos
 * como "limpiar override" — el sistema vuelve a leer `CHAT_PROVIDER` del env.
 */
const LLM_PROVIDER_CHOICES = [
  'anthropic',
  'openai-compat',
  'private-mac',
  'private-onprem',
] as const;

/**
 * Subobjeto del branding. JSON sin schema fijo en la DB, pero validamos los
 * campos conocidos para que el admin no meta basura sin querer.
 */
export class TenantBrandingDto {
  @ApiProperty({
    required: false,
    example: 'https://cdn.tenant.com/logo.png',
    description: 'URL pública del logo. https requerido en producción.',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string;

  @ApiProperty({
    required: false,
    example: '#43C194',
    description: 'Color de acento del tenant. Hex con #, ej. #FF6600.',
  })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiProperty({
    required: false,
    example: 'UTPL · Plataforma de IA',
    description:
      'Nombre visible en el header del shell. Si está vacío, se usa tenant.displayName.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}

export class UpdateTenantDto {
  @ApiProperty({ required: false, example: 'UTPL — IA' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  displayName?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['rag', 'comparator', 'tutor'],
    description:
      'Override de demos habilitados. Array vacío hereda la default de la industry.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  // Validación de IDs reales (estar en el catálogo) la hace el service —
  // class-validator no conoce el catálogo.
  @ArrayMinSize(0)
  @ArrayMaxSize(20)
  enabledDemos?: string[];

  @ApiProperty({ required: false, type: TenantBrandingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantBrandingDto)
  branding?: TenantBrandingDto;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: LLM_PROVIDER_CHOICES,
    example: 'anthropic',
    description:
      'Provider LLM activo para este tenant (ADR-0022). null = limpiar override y caer al CHAT_PROVIDER del env.',
  })
  @IsOptional()
  // `null` es válido (limpia el override). Si NO es null, debe estar en el
  // enum. `IsIn` no acepta null por default, así que combinamos con
  // `ValidateIf` para saltar la validación cuando el cliente manda null
  // explícito.
  @ValidateIf((_o, v) => v !== null)
  @IsIn(LLM_PROVIDER_CHOICES, {
    message: `llmProvider debe ser uno de: ${LLM_PROVIDER_CHOICES.join(', ')} (o null para limpiar).`,
  })
  llmProvider?: (typeof LLM_PROVIDER_CHOICES)[number] | null;
}
