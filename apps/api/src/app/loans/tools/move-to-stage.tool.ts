// -----------------------------------------------------------------------------
// Tool `move_to_stage` — mueve al socio entre etapas del funnel. La tool
// MÁS sensible — vive en el corazón del demo.
//
// El backend valida los criterios de salida de la etapa actual antes de
// aceptar la transición. Si los criterios no se cumplen, devuelve un
// tool_result con error que el LLM lee y corrige (típicamente diciendo
// "antes de pasar a X necesito Y").
//
// Criterios de salida por etapa:
//   - lead → qualification: LoanLead tiene fullName + phone + purpose.
//   - qualification → documentation: tiene requestedAmount + termMonths.
//   - documentation → credit_evaluation: tiene idNumber.
//   - credit_evaluation → approval: tiene lastEligibility.eligible === true.
//   - approval → disbursement: la solicitud en core está aprobada.
//   - disbursement → servicing: la solicitud en core está marcada disbursed.
//   - cualquier → rejected: aceptado siempre (terminal alternativo).
//
// Las transiciones backwards (ej. de documentation a qualification) no
// están permitidas en este sub-PR — la tool las rechaza.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import type { LoanStage } from '@org/db';

export const MOVE_TO_STAGE_TOOL: ChatTool = {
  name: 'move_to_stage',
  description:
    'Mueve al socio a la siguiente etapa del funnel cuando se cumplen los criterios de salida de la etapa actual. ' +
    'NO inventar etapas — usar solo las del flujo SEPS: lead, qualification, documentation, credit_evaluation, approval, disbursement, servicing, rejected. ' +
    'Si el backend rechaza la transición, leer el motivo y completar los datos faltantes antes de reintentar.',
  inputSchema: {
    type: 'object',
    properties: {
      toStage: {
        type: 'string',
        enum: [
          'qualification',
          'documentation',
          'credit_evaluation',
          'approval',
          'disbursement',
          'servicing',
          'rejected',
        ],
        description:
          'Etapa de destino. No se permite volver a `lead` (etapa inicial).',
      },
      reason: {
        type: 'string',
        description:
          'Razón breve y profesional de la transición (audit trail para SEPS, ej. "monto y plazo confirmados, pasamos a documentación").',
      },
    },
    required: ['toStage', 'reason'],
  },
};

export type MoveToStageTarget = Exclude<LoanStage, 'lead'>;

export interface MoveToStageInput {
  toStage: MoveToStageTarget;
  reason: string;
}

const VALID_TARGETS: ReadonlyArray<MoveToStageTarget> = [
  'qualification',
  'documentation',
  'credit_evaluation',
  'approval',
  'disbursement',
  'servicing',
  'rejected',
];

export function parseMoveToStageInput(
  input: unknown,
): MoveToStageInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<MoveToStageInput>;
  if (
    typeof o.toStage !== 'string' ||
    !VALID_TARGETS.includes(o.toStage as MoveToStageTarget)
  ) {
    return {
      error: `toStage inválido — usar uno de: ${VALID_TARGETS.join(', ')}.`,
    };
  }
  if (typeof o.reason !== 'string' || o.reason.trim().length < 5) {
    return {
      error: 'reason inválido — explicar brevemente por qué se mueve la etapa.',
    };
  }
  return {
    toStage: o.toStage as MoveToStageTarget,
    reason: o.reason.trim(),
  };
}

/**
 * Snapshot mínimo del lead que el validator usa. Toma este shape y NO el
 * `LoanLead` completo de Prisma para que los tests del validator sean
 * triviales — basta con armar el objeto a mano.
 */
export interface LeadStageSnapshot {
  currentStage: LoanStage;
  fullName?: string | null;
  phone?: string | null;
  purpose?: string | null;
  idNumber?: string | null;
  requestedAmount?: string | null;
  termMonths?: number | null;
  lastEligibility?: { eligible: boolean } | null;
  coreRequestId?: string | null;
}

export interface StageValidationOk {
  ok: true;
  fromStage: LoanStage;
  toStage: LoanStage;
}
export interface StageValidationErr {
  ok: false;
  error: string;
}
export type StageValidation = StageValidationOk | StageValidationErr;

/**
 * Valida una transición. Devuelve un resultado discriminado en vez de
 * lanzar para que la capa del LLM convierta el `error` en un
 * `tool_result.isError` que el modelo puede corregir.
 */
export function validateStageTransition(
  snapshot: LeadStageSnapshot,
  toStage: MoveToStageTarget,
): StageValidation {
  const from = snapshot.currentStage;

  // Rejected es terminal pero permitido desde cualquier etapa activa.
  if (toStage === 'rejected') {
    if (from === 'rejected') {
      return { ok: false, error: 'El lead ya está en estado rejected.' };
    }
    return { ok: true, fromStage: from, toStage };
  }

  // Forward-only — el orden canónico.
  const ORDER: LoanStage[] = [
    'lead',
    'qualification',
    'documentation',
    'credit_evaluation',
    'approval',
    'disbursement',
    'servicing',
  ];
  const iFrom = ORDER.indexOf(from);
  const iTo = ORDER.indexOf(toStage);
  if (iFrom === -1 || iTo === -1) {
    return {
      ok: false,
      error: `Transición no soportada: ${from} → ${toStage}.`,
    };
  }
  if (iTo !== iFrom + 1) {
    return {
      ok: false,
      error: `Transición inválida ${from} → ${toStage}. Solo se permite avanzar una etapa a la vez (etapa siguiente: ${ORDER[iFrom + 1] ?? 'ninguna'}).`,
    };
  }

  // Criterios de salida por etapa actual.
  switch (from) {
    case 'lead': {
      if (!snapshot.fullName || !snapshot.phone || !snapshot.purpose) {
        return {
          ok: false,
          error:
            'No se puede pasar a `qualification` — falta registrar al socio (nombre, teléfono y propósito). Llamar primero register_lead.',
        };
      }
      break;
    }
    case 'qualification': {
      if (!snapshot.requestedAmount || !snapshot.termMonths) {
        return {
          ok: false,
          error:
            'No se puede pasar a `documentation` — falta confirmar monto solicitado y plazo en meses.',
        };
      }
      break;
    }
    case 'documentation': {
      if (!snapshot.idNumber) {
        return {
          ok: false,
          error:
            'No se puede pasar a `credit_evaluation` — falta cédula del socio. Pedirla y llamar consult_core_banking antes.',
        };
      }
      break;
    }
    case 'credit_evaluation': {
      if (!snapshot.lastEligibility?.eligible) {
        return {
          ok: false,
          error:
            'No se puede pasar a `approval` — la última evaluación no fue elegible (o no se ha corrido calculate_loan_eligibility).',
        };
      }
      break;
    }
    case 'approval': {
      if (!snapshot.coreRequestId) {
        return {
          ok: false,
          error:
            'No se puede pasar a `disbursement` — falta registrar la solicitud en el core bancario.',
        };
      }
      break;
    }
    case 'disbursement':
      // Hacia servicing es transición libre (asumimos que el desembolso
      // se confirmó en el core en pasos previos).
      break;
    default:
      return { ok: false, error: `Etapa origen no soportada: ${from}.` };
  }

  return { ok: true, fromStage: from, toStage };
}
