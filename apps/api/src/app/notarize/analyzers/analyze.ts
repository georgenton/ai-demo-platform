// -----------------------------------------------------------------------------
// analyzeDocument — orquesta el LLM tool-use para producir un
// DocumentAnalysis a partir del texto extraído del PDF.
//
// Patrón simplificado vs HrService:
//   - Una sola vuelta del LLM (no loop multi-turn).
//   - Una sola tool (`submit_analysis`).
//   - Si el LLM no llama la tool en la primera vuelta → lanza.
//
// El tipo de doc determina qué system prompt usar (`ANALYZER_PROMPTS`).
// Cada prompt indica qué dimensiones extraer y qué riesgos buscar.
// -----------------------------------------------------------------------------

import { chat } from '@org/llm-adapter';
import type { ChatProvider, ChatRichMessage } from '@org/llm-adapter';

import type {
  DocumentAnalysis,
  NotarizedDocTypeDto,
} from '../dto/notarize.dto.js';

import { ANALYZER_PROMPTS, SUBMIT_ANALYSIS_TOOL } from './index.js';

/**
 * Cap razonable para el texto enviado al LLM. ~12k chars ≈ 3k tokens —
 * suficiente para la mayoría de actas/contratos cooperativos sin
 * cortarlos antes de tiempo, y barato en costo.
 *
 * Para documentos más largos, una iteración futura podría hacer
 * map-reduce (extraer chunk-by-chunk + consolidar). En esta vuelta:
 * truncar es honesto y rápido.
 */
const MAX_TEXT_CHARS = 12_000;

/**
 * Analiza el texto del documento y devuelve un `DocumentAnalysis`
 * estructurado. Si el LLM no llama la tool en la primera vuelta, o si
 * el input de la tool es inválido, lanza con mensaje claro.
 *
 * @param docType Tipo de documento — define el system prompt.
 * @param text Texto extraído del PDF. Se trunca a `MAX_TEXT_CHARS` si
 *             excede.
 * @param llmProvider Override opcional del provider (header
 *             `X-LLM-Provider` del request).
 */
export async function analyzeDocument(
  docType: NotarizedDocTypeDto,
  text: string,
  llmProvider?: ChatProvider,
): Promise<DocumentAnalysis> {
  const systemPrompt = ANALYZER_PROMPTS[docType];
  if (!systemPrompt) {
    throw new Error(`analyzeDocument: docType desconocido "${docType}".`);
  }

  const excerpt = truncate(text, MAX_TEXT_CHARS);

  const messages: ChatRichMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        'Analiza este documento y emite `submit_analysis` con el resultado:\n\n```\n' +
        excerpt +
        '\n```',
    },
  ];

  // Capturamos el primer `tool_use_complete` con name='submit_analysis'.
  // Si llega otro tool name (raro) lo ignoramos. Si nunca llega tool
  // call, lanzamos al final.
  let toolInput: unknown = null;

  for await (const event of chat.streamWithTools(
    messages,
    [SUBMIT_ANALYSIS_TOOL],
    { provider: llmProvider },
  )) {
    if (
      event.type === 'tool_use_complete' &&
      event.name === SUBMIT_ANALYSIS_TOOL.name
    ) {
      toolInput = event.input;
      // Igual seguimos drenando el stream para no dejar el iterador
      // colgado (algunos providers necesitan que se complete).
    }
  }

  if (toolInput === null) {
    throw new Error(
      'analyzeDocument: el LLM terminó sin llamar `submit_analysis`. Intenta de nuevo.',
    );
  }

  return parseAnalysisInput(docType, toolInput);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n\n[texto truncado por longitud]';
}

/**
 * Parsea + valida el input del tool a `DocumentAnalysis`. Si el LLM
 * devolvió un shape inválido (campo faltante, tipo equivocado), lanza
 * con mensaje claro — el caller decide si reintentar o exponer al user.
 */
function parseAnalysisInput(
  docType: NotarizedDocTypeDto,
  raw: unknown,
): DocumentAnalysis {
  if (!isObject(raw)) {
    throw new Error('parseAnalysisInput: input no es un objeto.');
  }

  const dimensionsRaw = raw.dimensions;
  if (!Array.isArray(dimensionsRaw)) {
    throw new Error('parseAnalysisInput: dimensions no es un array.');
  }
  const dimensions = dimensionsRaw.map((d, i) => {
    if (!isObject(d)) {
      throw new Error(`parseAnalysisInput: dimensions[${i}] no es un objeto.`);
    }
    const { key, label, value } = d as Record<string, unknown>;
    if (
      typeof key !== 'string' ||
      typeof label !== 'string' ||
      typeof value !== 'string'
    ) {
      throw new Error(
        `parseAnalysisInput: dimensions[${i}] debe tener key/label/value como strings.`,
      );
    }
    return { key, label, value };
  });

  const risksRaw = raw.risks;
  if (!Array.isArray(risksRaw)) {
    throw new Error('parseAnalysisInput: risks no es un array.');
  }
  const risks = risksRaw.map((r, i) => {
    if (!isObject(r)) {
      throw new Error(`parseAnalysisInput: risks[${i}] no es un objeto.`);
    }
    const { severity, title, description } = r as Record<string, unknown>;
    if (
      typeof title !== 'string' ||
      typeof description !== 'string' ||
      typeof severity !== 'string' ||
      !['high', 'medium', 'low', 'info'].includes(severity)
    ) {
      throw new Error(
        `parseAnalysisInput: risks[${i}] requiere severity ∈ {high,medium,low,info}, title, description.`,
      );
    }
    return {
      severity: severity as 'high' | 'medium' | 'low' | 'info',
      title,
      description,
    };
  });

  const recommendationsRaw = raw.recommendations;
  if (!Array.isArray(recommendationsRaw)) {
    throw new Error('parseAnalysisInput: recommendations no es un array.');
  }
  const recommendations = recommendationsRaw.map((r, i) => {
    if (typeof r !== 'string') {
      throw new Error(
        `parseAnalysisInput: recommendations[${i}] no es string.`,
      );
    }
    return r;
  });

  const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning : '';

  return {
    docType,
    dimensions,
    risks,
    recommendations,
    reasoning,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
