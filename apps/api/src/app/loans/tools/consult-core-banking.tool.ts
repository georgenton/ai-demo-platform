// -----------------------------------------------------------------------------
// Tool `consult_core_banking` — usada en etapas `qualification` y
// `credit_evaluation`. Verifica al socio en el core bancario (cédula) y
// trae historial crediticio para alimentar la calculadora de elegibilidad.
//
// Dos casos posibles:
//   - Cédula encontrada → devuelve MemberInfo + CreditHistory.
//   - Cédula no encontrada → mensaje claro para que el bot le diga al socio
//     que debe acercarse a una oficina para registrarse primero.
//
// SOLO llamar después de que el socio diga su cédula. No inventar números.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

export const CONSULT_CORE_BANKING_TOOL: ChatTool = {
  name: 'consult_core_banking',
  description:
    'Consulta al sistema bancario interno de la cooperativa (core) por la cédula del socio. ' +
    'Devuelve sus datos (nombre, fecha de afiliación, aporte de capital, si tiene préstamo activo) ' +
    'y su historial crediticio (score interno, ingresos, deudas mensuales). ' +
    'LLAMAR solo después de que el socio diga su cédula. Si el socio dice "no soy socio", NO llamar — sugerirle visitar oficina.',
  inputSchema: {
    type: 'object',
    properties: {
      idNumber: {
        type: 'string',
        description:
          'Cédula ecuatoriana de 10 dígitos tal como la dijo el socio (ej. "0102030405"). Sin guiones ni espacios.',
      },
    },
    required: ['idNumber'],
  },
};

export interface ConsultCoreBankingInput {
  idNumber: string;
}

const ID_NUMBER_RE = /^\d{10}$/;

export function parseConsultCoreBankingInput(
  input: unknown,
): ConsultCoreBankingInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<ConsultCoreBankingInput>;
  if (typeof o.idNumber !== 'string' || !ID_NUMBER_RE.test(o.idNumber.trim())) {
    return {
      error:
        'idNumber inválido — la cédula ecuatoriana son 10 dígitos. Pedir al socio el número completo.',
    };
  }
  return { idNumber: o.idNumber.trim() };
}
