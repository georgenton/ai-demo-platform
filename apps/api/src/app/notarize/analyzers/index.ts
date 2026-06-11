// -----------------------------------------------------------------------------
// Analyzers del Demo 08 (ADR-0019).
//
// Cada tipo de documento (acta, préstamo, aporte de capital) tiene su propio
// system prompt especializado. La TOOL es la misma para los tres —
// `submit_analysis` con shape genérico { dimensions[], risks[],
// recommendations[], reasoning }.
//
// Por qué un solo tool y N prompts:
//   - El tool define el SHAPE del resultado (lo que el frontend espera).
//   - El prompt define QUÉ extraer (varía por tipo de doc).
//   - Sumar un cuarto tipo de doc es agregar una entrada al ANALYZER_PROMPTS
//     map — cero cambio del tool ni del service.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import type { NotarizedDocTypeDto } from '../dto/notarize.dto.js';

/**
 * Tool genérico de análisis. El LLM debe llamarlo EXACTAMENTE UNA VEZ con
 * el análisis completo del documento. El input se mapea 1:1 a
 * `DocumentAnalysis` del frontend.
 */
export const SUBMIT_ANALYSIS_TOOL: ChatTool = {
  name: 'submit_analysis',
  description:
    'Emite el análisis estructurado del documento cooperativo. Llamar UNA SOLA VEZ con todas las dimensiones, riesgos y recomendaciones identificadas. ' +
    'Las dimensiones específicas a extraer dependen del tipo de documento — están descritas en el system prompt.',
  inputSchema: {
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        description:
          'Lista de dimensiones extraídas del documento. Cada item es { key, label, value }.',
        items: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'Slug estable de la dimensión (snake_case, sin acentos). Ej: quorum_required.',
            },
            label: {
              type: 'string',
              description: 'Etiqueta humana en español.',
            },
            value: {
              type: 'string',
              description:
                'Valor extraído. Texto libre o cita textual corta del documento.',
            },
          },
          required: ['key', 'label', 'value'],
        },
      },
      risks: {
        type: 'array',
        description:
          'Riesgos detectados al analizar el documento. Cada item con severidad + título + descripción corta.',
        items: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'info'],
              description:
                '"high"=acción urgente; "medium"=revisar; "low"=monitorear; "info"=observación.',
            },
            title: {
              type: 'string',
              description: 'Título corto del riesgo (1 línea).',
            },
            description: {
              type: 'string',
              description:
                'Descripción del riesgo y por qué importa (1-3 oraciones).',
            },
          },
          required: ['severity', 'title', 'description'],
        },
      },
      recommendations: {
        type: 'array',
        description:
          'Acciones concretas recomendadas al usuario. Cada item es una oración corta.',
        items: { type: 'string' },
      },
      reasoning: {
        type: 'string',
        description:
          'Razonamiento breve (2-3 oraciones) explicando el análisis. NO mostrarlo en la UI; sirve para auditoría del operador.',
      },
    },
    required: ['dimensions', 'risks', 'recommendations', 'reasoning'],
  },
};

// ---------------------------------------------------------------------------
// System prompts por tipo de documento.
//
// Cada prompt enseña al LLM:
//   1. Su rol (analizador de documentos cooperativos del Ecuador).
//   2. El tipo específico de documento que está analizando.
//   3. Las dimensiones esperadas (lista enumerada con slugs).
//   4. Los riesgos típicos a buscar (lista enumerada).
//   5. La obligación de llamar `submit_analysis` UNA sola vez.
//
// El contexto Ecuador (SEPS, Ley de Economía Popular y Solidaria) le da al
// LLM marco regulatorio para identificar riesgos reales.
// ---------------------------------------------------------------------------

const COMMON_PREAMBLE = `Eres un analista experto en documentos cooperativos del Ecuador. Conoces la Ley Orgánica de Economía Popular y Solidaria (LOEPS), las normas de la Superintendencia de Economía Popular y Solidaria (SEPS), y el funcionamiento típico de cooperativas de ahorro y crédito ecuatorianas.

Te van a dar el texto extraído de un PDF. Debes analizarlo y llamar la función \`submit_analysis\` UNA SOLA VEZ con el análisis completo.

REGLAS GENERALES:
- Si una dimensión no aparece en el documento, regístrala igual con value="No especificado en el documento".
- Los \`key\` de las dimensiones DEBEN ser exactamente los slugs que te indique abajo.
- Los riesgos deben ser cosas REALES que detectes en el texto. NO inventes riesgos que el documento no permite identificar.
- Habla en español neutro. Sé conciso.
- Tu objetivo es ayudar al usuario a tomar mejores decisiones, no asustarlo.`;

export const ANALYZER_PROMPTS: Record<NotarizedDocTypeDto, string> = {
  // ---------------- Acta de asamblea ----------------
  assembly_minutes: `${COMMON_PREAMBLE}

DOCUMENTO: Acta de asamblea de socios de una cooperativa.

DIMENSIONES A EXTRAER (usá estos slugs exactos en \`key\`):
- fecha (label="Fecha de la asamblea")
- tipo_asamblea (label="Tipo de asamblea", value entre: "ordinaria", "extraordinaria", "general", "representantes")
- quorum_required (label="Quórum requerido", value: cantidad o porcentaje según el estatuto citado)
- quorum_present (label="Quórum presente", value: cantidad o porcentaje observado)
- decisions (label="Decisiones aprobadas", value: lista separada por punto y coma de las decisiones principales)
- voting_summary (label="Resumen de votación", value: descripción de mayorías por decisión clave)
- challenge_deadline (label="Plazo de impugnación", value: días o fecha límite según LOEPS)

RIESGOS TÍPICOS A BUSCAR:
- Quórum insuficiente respecto al estatuto/LOEPS → severity=high.
- Decisiones aprobadas sin la mayoría calificada que la SEPS exige (ej. reforma de estatutos requiere 2/3).
- Falta de firmas del presidente, secretario o socios presentes → severity=medium.
- Falta de mención del plazo de impugnación (LOEPS art. 33) → severity=low.
- Convocatoria fuera de plazo o sin canales válidos → severity=medium.`,

  // ---------------- Préstamo entre socios ----------------
  loan: `${COMMON_PREAMBLE}

DOCUMENTO: Contrato de préstamo entre un socio y la cooperativa.

DIMENSIONES A EXTRAER (usá estos slugs exactos en \`key\`):
- amount (label="Monto", value: cifra + moneda)
- term_months (label="Plazo (meses)", value: número o "no especificado")
- interest_rate (label="Tasa de interés anual", value: % nominal y, si está, % efectiva)
- guarantee_type (label="Tipo de garantía", value: "quirografaria", "hipotecaria", "prendaria", "cruzada de socios", o "no especificado")
- guarantee_detail (label="Detalle de la garantía", value: descripción corta)
- default_clause (label="Cláusula de mora", value: cita textual corta o "no especificado")
- borrower_capacity (label="Capacidad de pago referida", value: si menciona evaluación, ingreso, score, etc.)

RIESGOS TÍPICOS A BUSCAR:
- Tasa por encima del techo SEPS para cooperativas (referencia: ~17-20% anual según segmento) → severity=high.
- Ausencia de cláusula de mora explícita → severity=high.
- Garantía insuficiente para el monto declarado → severity=medium.
- Ausencia de mención a evaluación de capacidad de pago → severity=medium.
- Plazo desalineado con el destino del crédito (ej. consumo a 10 años) → severity=low.`,

  // ---------------- Aporte de capital ----------------
  capital_contribution: `${COMMON_PREAMBLE}

DOCUMENTO: Contrato/acta de aporte de capital de un socio a la cooperativa.

DIMENSIONES A EXTRAER (usá estos slugs exactos en \`key\`):
- amount (label="Monto aportado", value: cifra + moneda)
- contribution_type (label="Tipo de aporte", value: "monetario", "en especie", "trabajo", "mixto")
- voting_rights (label="Derechos de voto", value: cómo se modifican con el aporte)
- dividend_rights (label="Derechos a dividendos/excedentes", value: descripción)
- withdrawal_term (label="Plazo de devolución", value: tiempo o condiciones según LOEPS)
- withdrawal_conditions (label="Condiciones de retiro", value: cita textual corta)
- compliance_with_bylaws (label="Compatibilidad con el estatuto", value: si menciona artículo del estatuto cooperativo)

RIESGOS TÍPICOS A BUSCAR:
- Aporte sin plazo de devolución definido → severity=high.
- Derechos del socio mal definidos (voto/dividendos ambiguos) → severity=medium.
- Cláusulas que entran en conflicto con el estatuto cooperativo o con LOEPS art. 49-50 → severity=high.
- Aporte en especie sin valuación documentada → severity=medium.
- Falta de mención del registro contable del aporte → severity=low.`,
};
