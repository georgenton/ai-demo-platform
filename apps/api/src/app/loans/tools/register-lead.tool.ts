// -----------------------------------------------------------------------------
// Tool `register_lead` — usada en etapa `lead` para guardar los datos
// iniciales del socio. Es la primera tool que el bot llama: una vez que
// tiene nombre + teléfono + propósito breve, persiste el LoanLead.
//
// Criterios de éxito que el bot DEBE cumplir antes de llamar:
//   - fullName: nombre completo del socio (3 palabras o más).
//   - phone: teléfono ecuatoriano (09XXXXXXXX o +5939XXXXXXXX).
//   - purpose: descripción del propósito del préstamo en lenguaje libre.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

export const REGISTER_LEAD_TOOL: ChatTool = {
  name: 'register_lead',
  description:
    'Registra los datos iniciales del socio (nombre completo, teléfono, propósito del préstamo) para crear su LoanLead en etapa `lead`. ' +
    'LLAMAR solo después de que el socio diga su nombre completo Y un teléfono Y para qué quiere el préstamo. ' +
    'NO inferir datos — pedirlos explícitamente al socio si faltan.',
  inputSchema: {
    type: 'object',
    properties: {
      fullName: {
        type: 'string',
        description:
          'Nombre completo del socio tal como lo dijo (ej. "Carlos Andrés Yánez Vargas").',
      },
      phone: {
        type: 'string',
        description:
          'Teléfono celular ecuatoriano (formato 09XXXXXXXX o +5939XXXXXXXX).',
      },
      purpose: {
        type: 'string',
        description:
          'Para qué necesita el préstamo el socio en lenguaje libre (ej. "capital de trabajo para su tienda", "emergencia médica", "comprar moto").',
      },
    },
    required: ['fullName', 'phone', 'purpose'],
  },
};

export interface RegisterLeadInput {
  fullName: string;
  phone: string;
  purpose: string;
}

const PHONE_RE = /^(\+5939\d{8}|09\d{8})$/;

/**
 * Valida el input del LLM antes de tocar la BD. El LLM puede inventar
 * teléfonos o nombres incompletos — atajamos eso acá y devolvemos un
 * tool_result error que el LLM lee y corrige en el siguiente turn.
 */
export function parseRegisterLeadInput(
  input: unknown,
): RegisterLeadInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<RegisterLeadInput>;
  if (
    typeof o.fullName !== 'string' ||
    o.fullName.trim().split(/\s+/).length < 2
  ) {
    return {
      error:
        'fullName inválido — pedir al socio nombre + apellido completos (mínimo 2 palabras).',
    };
  }
  if (typeof o.phone !== 'string' || !PHONE_RE.test(o.phone.trim())) {
    return {
      error:
        'phone inválido — pedir al socio número celular ecuatoriano (formato 09XXXXXXXX o +5939XXXXXXXX).',
    };
  }
  if (typeof o.purpose !== 'string' || o.purpose.trim().length < 5) {
    return {
      error:
        'purpose inválido — pedir al socio que describa para qué quiere el préstamo.',
    };
  }
  return {
    fullName: o.fullName.trim(),
    phone: o.phone.trim(),
    purpose: o.purpose.trim(),
  };
}
