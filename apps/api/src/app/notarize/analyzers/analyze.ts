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
import type {
  ChatMessage,
  ChatProvider,
  ChatRichMessage,
} from '@org/llm-adapter';

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
    if (shouldUseJsonFallback(llmProvider)) {
      return analyzeDocumentWithJsonFallback(
        docType,
        systemPrompt,
        excerpt,
        llmProvider,
      );
    }

    throw new Error(
      'analyzeDocument: el LLM terminó sin llamar `submit_analysis`. Intenta de nuevo.',
    );
  }

  return parseAnalysisInput(docType, toolInput);
}

/**
 * Fallback para providers OpenAI-compatible locales que pueden responder texto
 * pero no siempre emiten `tool_calls` reales. Mantiene el mismo shape final
 * (`DocumentAnalysis`) y se valida con el mismo parser estricto.
 */
async function analyzeDocumentWithJsonFallback(
  docType: NotarizedDocTypeDto,
  systemPrompt: string,
  excerpt: string,
  llmProvider?: ChatProvider,
): Promise<DocumentAnalysis> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        systemPrompt +
        '\n\nMODO COMPATIBILIDAD JSON: no tienes herramientas disponibles. ' +
        'Ignora cualquier instrucción anterior que diga llamar una función. ' +
        'Debes responder EXCLUSIVAMENTE un objeto JSON válido, sin markdown, ' +
        'sin explicación adicional y sin texto antes o después. El JSON debe ' +
        'tener exactamente esta forma: {"dimensions":[{"key":"...","label":"...","value":"..."}],"risks":[{"severity":"info","title":"...","description":"..."}],"recommendations":["..."],"reasoning":"..."}.',
    },
    {
      role: 'user',
      content:
        'Analiza este documento y devuelve SOLO el JSON solicitado:\n\n```\n' +
        excerpt +
        '\n```',
    },
  ];

  let rawText = '';
  for await (const chunk of chat.completeStream(messages, {
    provider: llmProvider,
  })) {
    rawText += chunk;
  }

  const raw = parseJsonFromModelText(rawText);
  return parseAnalysisInput(docType, raw);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n\n[texto truncado por longitud]';
}

function shouldUseJsonFallback(llmProvider?: ChatProvider): boolean {
  const provider = llmProvider ?? process.env.CHAT_PROVIDER;
  return (
    provider === 'private-mac' ||
    provider === 'private-onprem' ||
    provider === 'openai-compat'
  );
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const candidate = extractFirstJsonObject(unfenced);
    if (!candidate) {
      throw new Error(
        'parseJsonFromModelText: el fallback JSON no devolvió un objeto JSON válido.',
      );
    }
    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error(
        'parseJsonFromModelText: el fallback JSON devolvió JSON malformado.',
      );
    }
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
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
