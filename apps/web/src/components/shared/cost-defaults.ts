// -----------------------------------------------------------------------------
// Defaults por demo para el cost mini-widget — segunda fila proyectada.
//
// Cada demo tiene una "unidad de uso" distinta (consulta, comparación,
// búsqueda, query). El cost engine usa la misma fórmula para todos
// (`projectMonthlyCost`), pero la UI cambia el label y los valores por
// default según el demo.
//
// Por qué centralizamos acá:
//   - Las páginas solo le pasan el `demoId` al CostMiniWidget. Toda la
//     parametrización vive en este archivo. Si Jorge ajusta los defaults
//     después de QA con un cliente, hay un solo lugar a tocar.
//   - El "valor de referencia conservador" en tokens/uso es lo que el
//     widget muestra cuando la sesión actual está vacía (recién abierta).
//     Eso evita el estado "$0/mes" inicial, que se ve flojo en demo en
//     vivo.
// -----------------------------------------------------------------------------

import type { DemoId } from '@/lib/api';
import type { StringKey } from '@/lib/i18n';
import type { TutorUsage } from '@/lib/api';

export interface DemoCostDefaults {
  /** Cantidad de usuarios activos al mes por default. */
  defaultUsers: number;
  /** Cantidad de usos/usuario/mes por default. */
  defaultUsesPerUserPerMonth: number;
  /**
   * Tokens de UN uso típico cuando la sesión actual todavía está vacía.
   * Calibrado con valores realistas observados en producción para cada
   * demo. Si las llamadas reales cambian sustancialmente, ajustar acá
   * (preferible) o dejar que el promedio de la sesión lo "corrija" en
   * vivo.
   */
  referenceTokensPerUse: TutorUsage;
  /** i18n key del label de la frecuencia ("Consultas/mes", "Comparaciones/mes", …). */
  usesLabelKey: StringKey;
}

/**
 * Espejo de la unidad de uso por demo. Notas:
 *   - RAG: una consulta promedio toma ~1.5K input (system + chunks + pregunta)
 *     + ~500 output (respuesta cortica con citas). 2K es conservador.
 *   - Comparator: cada comparación procesa varios documentos enteros. ~8K
 *     input + ~2K output cubren el caso típico de 2-3 contratos.
 *   - Corpus search: similar al RAG pero el resultado suele ser más largo
 *     (síntesis sobre varios papers). 3K input + 1.5K output.
 *   - Agent: SQL + resultados + razonamiento. El payload promedio es
 *     mayor por las idas y vueltas del tool use. 2K input + 1K output.
 *
 * Defaults de usuarios y frecuencia: pensados para "una universidad mediana
 * en Ecuador con un equipo concreto usando el sistema". Realistas, no
 * apocalípticos.
 */
export const DEMO_COST_DEFAULTS: Record<DemoId, DemoCostDefaults> = {
  rag: {
    defaultUsers: 100,
    defaultUsesPerUserPerMonth: 50,
    referenceTokensPerUse: { inputTokens: 1_500, outputTokens: 500 },
    usesLabelKey: 'costMini.uses.rag',
  },
  comparator: {
    defaultUsers: 10,
    defaultUsesPerUserPerMonth: 20,
    referenceTokensPerUse: { inputTokens: 8_000, outputTokens: 2_000 },
    usesLabelKey: 'costMini.uses.comparator',
  },
  corpus: {
    defaultUsers: 10,
    defaultUsesPerUserPerMonth: 30,
    referenceTokensPerUse: { inputTokens: 3_000, outputTokens: 1_500 },
    usesLabelKey: 'costMini.uses.corpus',
  },
  agent: {
    defaultUsers: 5,
    defaultUsesPerUserPerMonth: 220,
    referenceTokensPerUse: { inputTokens: 2_000, outputTokens: 1_000 },
    usesLabelKey: 'costMini.uses.agent',
  },
  tutor: {
    // El tutor tiene su propio TutorCostPanel grande con proyección
    // semestre, así que estos valores no se usan. Los dejamos por
    // exhaustividad del Record<DemoId, …> (TypeScript exige cubrir
    // todos los IDs del union literal).
    defaultUsers: 500,
    defaultUsesPerUserPerMonth: 12,
    referenceTokensPerUse: { inputTokens: 1_000, outputTokens: 500 },
    usesLabelKey: 'costMini.uses.rag',
  },
  clinical: {
    // Demo 06 — no usa CostMiniWidget en su primera vuelta (la página
    // del asistente clínico no tiene proyección de costo todavía). Los
    // valores son razonables para una clínica mediana: 30 médicos × 60
    // consultas mensuales por médico ≈ 1.800 análisis. Cubre el
    // Record<DemoId, …> exhaustivo y queda listo si en el futuro se
    // suma el widget.
    defaultUsers: 30,
    defaultUsesPerUserPerMonth: 60,
    referenceTokensPerUse: { inputTokens: 4_000, outputTokens: 1_000 },
    usesLabelKey: 'costMini.uses.clinical',
  },
  interview: {
    // Demo 07 — el avatar entrevistador no usa CostMiniWidget tampoco (es
    // un demo más conversacional). Si en el futuro se suma, una empresa
    // mediana ≈ 5 reclutadores × 100 entrevistas/mes = 500 entrevistas.
    // Cada entrevista termina en un finalize con scoring estructurado
    // (~6K input + 1.5K output por entrevista, no por respuesta).
    defaultUsers: 5,
    defaultUsesPerUserPerMonth: 100,
    referenceTokensPerUse: { inputTokens: 6_000, outputTokens: 1_500 },
    usesLabelKey: 'costMini.uses.interview',
  },
  notarize: {
    // Demo 08 — notarización cooperativa. Una cooperativa mediana procesa
    // ~20 documentos al día entre actas, préstamos y aportes ≈ 600/mes.
    // Cada análisis es un solo turn del LLM con tool calling
    // (~3K input + ~1K output por documento).
    defaultUsers: 1,
    defaultUsesPerUserPerMonth: 600,
    referenceTokensPerUse: { inputTokens: 3_000, outputTokens: 1_000 },
    usesLabelKey: 'costMini.uses.notarize',
  },
  loans: {
    // Demo 09 — funnel de préstamos. Cada "uso" = una conversación
    // completa con el bot (típicamente 6-10 turns con tool calls).
    // Una CAC mediana procesa ~200 solicitudes/mes; con ~8K input
    // promedio (system prompt + history) + ~2K output por conversación.
    defaultUsers: 1,
    defaultUsesPerUserPerMonth: 200,
    referenceTokensPerUse: { inputTokens: 8_000, outputTokens: 2_000 },
    usesLabelKey: 'costMini.uses.loans',
  },
  bi: {
    // Demo 10 — dashboard inteligente. Cada "uso" = una pregunta del
    // gerente que dispara run_sql + render_chart. Una CAC mediana, 5
    // gerentes haciendo ~30 preguntas/mes cada uno = 150 queries/mes.
    // Tokens: system prompt (catálogo de tablas) + tool calls + narrativa
    // ≈ 6K input + 1.5K output por pregunta.
    defaultUsers: 5,
    defaultUsesPerUserPerMonth: 30,
    referenceTokensPerUse: { inputTokens: 6_000, outputTokens: 1_500 },
    usesLabelKey: 'costMini.uses.bi',
  },
};
