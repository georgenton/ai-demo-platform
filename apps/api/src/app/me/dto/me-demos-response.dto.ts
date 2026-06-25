// -----------------------------------------------------------------------------
// DTOs de respuesta del GET /api/v1/me/demos.
//
// Usa class para que @nestjs/swagger genere el schema OpenAPI automático.
// El frontend en Claude Design consume estos contratos cuando construye el
// dashboard del tenant.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';

import { DemoMetadata } from '../../demos/demo-registry.types.js';

export class MeTenantInfoDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: 'utpl' })
  slug!: string;

  @ApiProperty({ example: 'Universidad Técnica Particular de Loja' })
  displayName!: string;

  @ApiProperty({
    description:
      'Branding del tenant: logoUrl, accentColor, etc. JSON sin schema fijo.',
    example: { accentColor: '#0A66C2', logoUrl: 'https://...' },
  })
  branding!: unknown;

  @ApiProperty({ enum: ['active', 'trial', 'suspended'] })
  status!: 'active' | 'trial' | 'suspended';

  @ApiProperty({
    nullable: true,
    enum: ['anthropic', 'openai-compat', 'private-mac', 'private-onprem'],
    description:
      'Provider LLM activo para este tenant (ADR-0022). null = el sistema cae al CHAT_PROVIDER de env vars. El frontend usa este valor como fallback del header X-LLM-Provider cuando el user no eligió manualmente.',
    example: 'anthropic',
  })
  llmProvider!: string | null;
}

export class MeIndustryInfoDto {
  @ApiProperty({ example: 'universidad' })
  slug!: string;

  @ApiProperty({ example: 'Educación superior' })
  displayName!: string;

  @ApiProperty({
    description:
      'Defaults de la industria: welcomeCopy, prompts especializados, etc.',
    example: { welcomeCopy: 'Plataforma de IA para universidades...' },
  })
  defaultConfig!: unknown;
}

export class MeDemosResponseDto {
  @ApiProperty({ type: MeTenantInfoDto })
  tenant!: MeTenantInfoDto;

  @ApiProperty({ type: MeIndustryInfoDto })
  industry!: MeIndustryInfoDto;

  @ApiProperty({
    description:
      'Catálogo completo de demos HABILITADOS para este tenant — ya con la regla de herencia aplicada. El frontend pinta solo estos. Sin demos no habilitados.',
    type: [DemoMetadata],
  })
  demos!: DemoMetadata[];

  @ApiProperty({
    description:
      'true si la lista vino del override del tenant; false si heredó de la industry. Útil para mostrar "Configuración personalizada" en el admin.',
  })
  overridden!: boolean;
}
