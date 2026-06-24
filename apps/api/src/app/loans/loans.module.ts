// -----------------------------------------------------------------------------
// LoansModule — NestJS module del Demo 09.
//
// Wiring:
//   - LoansController (REST + SSE).
//   - LoansService (orquestador del chat con tool calling).
//   - CORE_BANKING token DI → MockCoreBankingAdapter por defecto. Cuando un
//     cliente real firme con Cobis/Conexus/Compac, se cambia el provider
//     en el switch del factory y este módulo no se toca.
//
// El MockCoreBankingAdapter es singleton porque mantiene estado in-memory
// (loanRequests creados durante la sesión). Usando coreBankingFor() del
// factory garantizamos que dos requests al mismo proceso compartan el
// mismo mock.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';

import { coreBankingFor } from '@org/core-banking-adapter';

import { LoansController } from './loans.controller.js';
import { CORE_BANKING, LoansService } from './loans.service.js';

@Module({
  controllers: [LoansController],
  providers: [
    LoansService,
    {
      provide: CORE_BANKING,
      useFactory: () => coreBankingFor('mock', {}),
    },
  ],
})
export class LoansModule {}
