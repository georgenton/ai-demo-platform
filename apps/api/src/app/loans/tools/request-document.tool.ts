// -----------------------------------------------------------------------------
// Tool `request_document` — usada en etapa `documentation`. Le dice al
// frontend que muestre el upload de un tipo específico de documento.
//
// Esta tool NO persiste el documento — solo le pide al socio que lo suba.
// El upload real se hace por un endpoint separado (`POST /api/v1/loans/:id/upload`
// en sub-PR futuro). Para el demo, basta con simular que el bot pide y el
// frontend muestra el componente de upload.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

export type RequestedDocumentKind = 'id_card' | 'payroll' | 'utility_bill';

export const REQUEST_DOCUMENT_TOOL: ChatTool = {
  name: 'request_document',
  description:
    'Pide al socio que suba un documento específico. Llamar en etapa `documentation` o cuando se necesite validar identidad/ingresos antes de pre-calificar. ' +
    'Tipos válidos: id_card (cédula de identidad), payroll (rol de pagos), utility_bill (planilla de luz, agua o teléfono). ' +
    'Después de llamar esta tool, esperar la respuesta del socio antes de pedir otro documento.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['id_card', 'payroll', 'utility_bill'],
        description:
          'Tipo de documento pedido: id_card (cédula), payroll (rol de pagos), utility_bill (planilla de servicio básico).',
      },
      reason: {
        type: 'string',
        description:
          'Razón corta y cordial que el bot mostrará al socio (ej. "Para validar tu identidad necesito una foto clara de tu cédula").',
      },
    },
    required: ['kind', 'reason'],
  },
};

export interface RequestDocumentInput {
  kind: RequestedDocumentKind;
  reason: string;
}

const VALID_KINDS: ReadonlyArray<RequestedDocumentKind> = [
  'id_card',
  'payroll',
  'utility_bill',
];

export function parseRequestDocumentInput(
  input: unknown,
): RequestDocumentInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<RequestDocumentInput>;
  if (
    typeof o.kind !== 'string' ||
    !VALID_KINDS.includes(o.kind as RequestedDocumentKind)
  ) {
    return {
      error: `kind inválido — usar uno de: ${VALID_KINDS.join(', ')}.`,
    };
  }
  if (typeof o.reason !== 'string' || o.reason.trim().length < 5) {
    return {
      error:
        'reason inválido — explicar al socio por qué necesitas el documento.',
    };
  }
  return {
    kind: o.kind as RequestedDocumentKind,
    reason: o.reason.trim(),
  };
}
