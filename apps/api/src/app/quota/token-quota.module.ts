// -----------------------------------------------------------------------------
// TokenQuotaModule — expone el service y el guard para usar en otros módulos.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { TokenQuotaGuard } from './token-quota.guard.js';
import { TokenQuotaService } from './token-quota.service.js';

@Module({
  providers: [TokenQuotaService, TokenQuotaGuard],
  exports: [TokenQuotaService, TokenQuotaGuard],
})
export class TokenQuotaModule {}
