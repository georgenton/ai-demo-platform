// -----------------------------------------------------------------------------
// "Vademécum" mock para el Demo 06.
//
// IMPORTANTE — alcance y honestidad:
//   - Esta NO es una base farmacológica real. Es una muestra ficticia con ~30
//     pares de interacciones medicamentosas conocidas y verosímiles, suficientes
//     para que el demo se sienta creíble cuando el médico ve a María Elena
//     (warfarina + AAS) o a Luis Fernando (warfarina + ibuprofeno).
//   - En producción, esta función debe reemplazarse por una llamada al
//     vademécum institucional del cliente o a una API farmacológica
//     certificada (ej. Lexicomp, Micromedex). Se documenta en el ADR-0016.
//   - El frontend mostrará un banner permanente aclarándolo (PR #3).
//
// Cómo lo consume el LLM:
//   El AgentService define un tool `check_drug_interactions(medications)`.
//   Cuando el LLM razona "voy a recetar X, este paciente toma Y, ¿hay riesgo?",
//   llama al tool con `medications = [X, Y, ...listado de actuales]`. El
//   service ejecuta `checkDrugInteractions(meds)` y devuelve la lista al LLM,
//   que la incorpora en su respuesta al médico.
//
// Algoritmo:
//   1) Normalizamos cada medicación a su "principio activo" (lowercase, sin
//      dosis ni vía). Ej: "metformina 850mg BID" → "metformina".
//   2) Buscamos pares (A, B) en `INTERACTIONS` donde ambos estén en la lista
//      normalizada. Comparamos como conjunto, sin orden.
//   3) Devolvemos las que matchean con su severity y descripción.
// -----------------------------------------------------------------------------

/** Severidad de una interacción. Espejo de lo que el LLM y el frontend muestran. */
export type InteractionSeverity = 'leve' | 'moderada' | 'grave';

export interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  description: string;
}

/**
 * Tabla de interacciones. Cada entrada es un par no-ordenado: el lookup hace
 * la comparación en ambos sentidos, así que poner (A, B) cubre también (B, A).
 *
 * Las descripciones son resúmenes clínicos breves — el LLM las parafrasea
 * en su respuesta al médico.
 */
export const INTERACTIONS: DrugInteraction[] = [
  // --- Anticoagulantes (alta criticidad clínica) ---
  {
    drugA: 'warfarina',
    drugB: 'aas',
    severity: 'grave',
    description:
      'Riesgo aumentado de sangrado. La AAS potencia el efecto anticoagulante de la warfarina. Vigilar INR y signos de sangrado.',
  },
  {
    drugA: 'warfarina',
    drugB: 'ibuprofeno',
    severity: 'grave',
    description:
      'AINEs incrementan el riesgo de sangrado gastrointestinal en pacientes anticoagulados. Preferir paracetamol.',
  },
  {
    drugA: 'warfarina',
    drugB: 'amoxicilina',
    severity: 'moderada',
    description:
      'Antibióticos pueden alterar la flora intestinal y modificar el metabolismo de la warfarina. Monitorear INR a las 48-72h.',
  },
  {
    drugA: 'warfarina',
    drugB: 'paracetamol',
    severity: 'leve',
    description:
      'A dosis >2g/día por más de una semana puede incrementar INR. A dosis estándar es la alternativa preferida frente a AINEs.',
  },
  {
    drugA: 'warfarina',
    drugB: 'amiodarona',
    severity: 'grave',
    description:
      'Inhibición del metabolismo de la warfarina. Reducir dosis de warfarina en aproximadamente 30-50%.',
  },

  // --- Cardiovasculares ---
  {
    drugA: 'enalapril',
    drugB: 'espironolactona',
    severity: 'moderada',
    description:
      'Riesgo de hiperpotasemia, especialmente con función renal reducida. Vigilar potasio sérico.',
  },
  {
    drugA: 'losartan',
    drugB: 'espironolactona',
    severity: 'moderada',
    description:
      'Riesgo de hiperpotasemia. Vigilar potasio sérico al inicio y tras ajustes de dosis.',
  },
  {
    drugA: 'digoxina',
    drugB: 'amiodarona',
    severity: 'grave',
    description:
      'Amiodarona aumenta los niveles séricos de digoxina, riesgo de toxicidad digitálica. Reducir dosis de digoxina a la mitad.',
  },
  {
    drugA: 'digoxina',
    drugB: 'furosemida',
    severity: 'moderada',
    description:
      'La hipopotasemia inducida por furosemida potencia la toxicidad de la digoxina. Monitorear electrolitos.',
  },
  {
    drugA: 'metoprolol',
    drugB: 'amlodipino',
    severity: 'leve',
    description:
      'Posible bradicardia o hipotensión aditiva. Vigilar al inicio del tratamiento combinado.',
  },
  {
    drugA: 'atorvastatina',
    drugB: 'amiodarona',
    severity: 'moderada',
    description:
      'Riesgo aumentado de miopatía y rabdomiólisis. No superar atorvastatina 20mg/día.',
  },

  // --- Diabetes ---
  {
    drugA: 'metformina',
    drugB: 'furosemida',
    severity: 'leve',
    description:
      'Furosemida puede reducir el efecto hipoglucemiante de la metformina. Vigilar glucemias.',
  },
  {
    drugA: 'insulina',
    drugB: 'metoprolol',
    severity: 'moderada',
    description:
      'Beta-bloqueadores pueden enmascarar síntomas adrenérgicos de hipoglucemia (taquicardia, temblor). Educar al paciente sobre síntomas alternos.',
  },

  // --- AINEs y dolor ---
  {
    drugA: 'ibuprofeno',
    drugB: 'enalapril',
    severity: 'moderada',
    description:
      'AINEs reducen el efecto antihipertensivo de los IECA y aumentan el riesgo de injuria renal aguda. Evitar uso crónico combinado.',
  },
  {
    drugA: 'ibuprofeno',
    drugB: 'losartan',
    severity: 'moderada',
    description:
      'AINEs reducen el efecto antihipertensivo de los ARA-II y aumentan el riesgo de injuria renal aguda.',
  },
  {
    drugA: 'ibuprofeno',
    drugB: 'furosemida',
    severity: 'moderada',
    description:
      'AINEs reducen el efecto diurético y aumentan el riesgo de injuria renal en pacientes con insuficiencia cardíaca.',
  },
  {
    drugA: 'tramadol',
    drugB: 'sumatriptan',
    severity: 'grave',
    description:
      'Ambos elevan serotonina central. Riesgo de síndrome serotoninérgico (fiebre, agitación, rigidez).',
  },

  // --- Psiquiatría ---
  {
    drugA: 'amitriptilina',
    drugB: 'tramadol',
    severity: 'moderada',
    description:
      'Riesgo aditivo de síndrome serotoninérgico y descenso del umbral convulsivo. Usar con cautela.',
  },
  {
    drugA: 'amitriptilina',
    drugB: 'sumatriptan',
    severity: 'moderada',
    description:
      'Riesgo de síndrome serotoninérgico. Vigilar primeras 24h tras administración conjunta.',
  },
  {
    drugA: 'pregabalina',
    drugB: 'tramadol',
    severity: 'moderada',
    description:
      'Depresión del SNC aditiva. Riesgo de sedación profunda y depresión respiratoria, especialmente en adultos mayores.',
  },
  {
    drugA: 'propranolol',
    drugB: 'salbutamol',
    severity: 'moderada',
    description:
      'Beta-bloqueadores no selectivos antagonizan el efecto broncodilatador del salbutamol. Preferir cardioselectivos en asmáticos.',
  },

  // --- Antibióticos ---
  {
    drugA: 'amoxicilina',
    drugB: 'anticonceptivo oral combinado',
    severity: 'leve',
    description:
      'Posible reducción del efecto anticonceptivo. Recomendar método de barrera adicional durante el tratamiento.',
  },
  {
    drugA: 'levotiroxina',
    drugB: 'omeprazol',
    severity: 'leve',
    description:
      'IBPs reducen la absorción de levotiroxina. Separar tomas por al menos 4 horas. Reevaluar TSH a las 6 semanas.',
  },

  // --- Tiroides y otros ---
  {
    drugA: 'levotiroxina',
    drugB: 'warfarina',
    severity: 'moderada',
    description:
      'Levotiroxina puede potenciar el efecto de la warfarina. Vigilar INR al iniciar o ajustar la dosis de levotiroxina.',
  },
  {
    drugA: 'alendronato',
    drugB: 'omeprazol',
    severity: 'leve',
    description:
      'Posible reducción de la eficacia del alendronato. Verificar adherencia a la indicación de toma en ayunas.',
  },
];

/**
 * Normaliza una entrada de medicación a su principio activo.
 *
 * Estrategia: lowercase + saca dosis comunes (números + unidades + frecuencia).
 * No es perfecto pero cubre el dataset del seed: "metformina 850mg BID" →
 * "metformina", "insulina NPH 20U AM / 12U PM" → "insulina nph".
 *
 * Para los pacientes del seed, esto es suficiente. En producción se haría con
 * un lexer farmacológico real (RxNorm o similar).
 */
export function normalizeMedication(med: string): string {
  return med
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|u|ml|ui|%)\b/gi, '')
    .replace(/\b(qd|bid|tid|qid|qhs|prn|am|pm|sc|im|iv|po|vo|sl)\b/gi, '')
    .replace(/\b(semanal|diario|mensual|cada|horas?|hrs?|dias?)\b/gi, '')
    .replace(/[/(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Para cada par (A, B) de la tabla, devuelve el match si AMBAS drogas aparecen
 * en la lista normalizada del paciente.
 *
 * La comparación es "contains" — `"warfarina"` matchea con `"warfarina 5mg qd"`.
 */
export function checkDrugInteractions(
  medications: string[],
): DrugInteraction[] {
  const normalized = medications.map(normalizeMedication);

  const matches: DrugInteraction[] = [];
  for (const interaction of INTERACTIONS) {
    const hasA = normalized.some((m) => m.includes(interaction.drugA));
    const hasB = normalized.some((m) => m.includes(interaction.drugB));
    if (hasA && hasB) {
      matches.push(interaction);
    }
  }
  return matches;
}
