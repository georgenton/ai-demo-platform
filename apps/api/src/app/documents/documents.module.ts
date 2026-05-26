// DocumentsModule — capa de lectura/borrado sobre Document.
//
// El service se registra como provider plano (tiene @Injectable y solo usa
// `prisma` que viene de @org/db). No exportamos nada hoy — si otros módulos
// necesitan consultar Document, agregamos al exports.

import { Module } from '@nestjs/common';

import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
