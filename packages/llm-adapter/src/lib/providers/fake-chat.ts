// -----------------------------------------------------------------------------
// FakeChatAdapter — implementación determinística de ChatAdapter para tests
// E2E y CI sin keys.
//
// Estrategia: detecta palabras clave en el último mensaje del usuario y
// devuelve respuestas predefinidas que coinciden con las preguntas sugeridas
// de cada demo. No es un mock genérico — está afinado para que los tests
// del flujo completo den respuestas plausibles sin ser triviales.
//
// completeStream  → Demo 01 (RAG) + Demo 02 (Comparator)
// streamWithTools → Demo 04 (Agent con tool use run_sql)
//
// Cómo se mantiene sincronizado con la app:
//   - Las preguntas sugeridas viven en apps/web/.../strings.ts y NO se
//     hardcodean literalmente acá — el fake matchea por palabras clave
//     (matrícula, recalificación, propiedad intelectual, etc.), así que
//     si el copy de la UI cambia un poco, el fake sigue respondiendo.
//   - Si agregás un demo nuevo o cambiás el SYSTEM_PROMPT del agente con
//     keywords distintas, hay que actualizar este archivo.
// -----------------------------------------------------------------------------

import type {
  AssistantStreamEvent,
  ChatAdapter,
  ChatConfig,
  ChatMessage,
  ChatRichMessage,
  ChatTool,
  ChatUsage,
  StreamWithUsage,
} from '../types.js';

export class FakeChatAdapter implements ChatAdapter {
  constructor(_config: ChatConfig) {
    // Param sin usar — la config simétrica con el real existe solo para
    // que la factory pueda construirlo igual.
    void _config;
  }

  // ---------------------------------------------------------------------------
  // completeStream — RAG (Demo 01) y Comparator (Demo 02)
  // ---------------------------------------------------------------------------

  async *completeStream(messages: ChatMessage[]): AsyncIterable<string> {
    const lastUser = lastUserMessage(messages);
    const response = pickRagResponse(lastUser);
    yield* streamTokens(response);
  }

  // ---------------------------------------------------------------------------
  // completeStreamWithUsage — Demo 05 (tutor) sin LLM real
  //
  // El fake no llama a ningún proveedor, así que no hay "usage real". Estimamos
  // tokens con la regla heurística usada en toda la industria: ~4 chars por
  // token en inglés / español. Es aproximada pero suficiente para que los
  // tests del cost engine se vean coherentes y para que el demo en modo fake
  // muestre un contador que se mueve.
  // ---------------------------------------------------------------------------

  completeStreamWithUsage(messages: ChatMessage[]): StreamWithUsage {
    const lastUser = lastUserMessage(messages);
    const response = pickTutorResponse(lastUser) ?? pickRagResponse(lastUser);

    // Input = suma del contenido de todos los mensajes que viajan al LLM.
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const usageValue: ChatUsage = {
      inputTokens: estimateTokens(inputChars),
      outputTokens: estimateTokens(response.length),
    };

    let resolveUsage!: (u: ChatUsage) => void;
    const usage = new Promise<ChatUsage>((res) => {
      resolveUsage = res;
    });

    async function* iterate(): AsyncIterable<string> {
      for await (const tok of streamTokens(response)) {
        yield tok;
      }
      resolveUsage(usageValue);
    }

    return { stream: iterate(), usage };
  }

  // ---------------------------------------------------------------------------
  // streamWithTools — Agent (Demo 04)
  //
  // El loop del AgentService funciona así:
  //   Turn 1: user envía pregunta → fake emite `tool_use_complete` con SQL
  //           apropiado + `turn_end(tool_use)`
  //   Turn 2: user envía tool_results → fake emite `text_delta` con respuesta
  //           final + `turn_end(end_turn)`
  //
  // Detectamos en qué turn estamos mirando si el último mensaje user es
  // string (primera vuelta) o array de tool_results (segunda+).
  // ---------------------------------------------------------------------------

  async *streamWithTools(
    messages: ChatRichMessage[],
    _tools: ChatTool[],
  ): AsyncIterable<AssistantStreamEvent> {
    void _tools;

    const lastUser = lastRichUserMessage(messages);
    if (!lastUser) {
      yield { type: 'turn_end', stopReason: 'end_turn' };
      return;
    }

    if (typeof lastUser.content === 'string') {
      // ── Turn 1: primer mensaje del user → pedir SQL via tool_use ────────
      const userText = lastUser.content;
      const sql = pickSqlForQuestion(userText);
      yield {
        type: 'tool_use_complete',
        id: `fake_tool_${djb2(userText)}`,
        name: 'run_sql',
        input: { sql },
      };
      yield { type: 'turn_end', stopReason: 'tool_use' };
      return;
    }

    // ── Turn 2+: el user envió tool_results → respuesta final en texto ─────
    // Buscamos el texto del último user content del turn anterior (la
    // pregunta original) para personalizar la respuesta. Si no lo
    // encontramos, devolvemos una genérica.
    const originalQuestion = findEarliestUserQuestion(messages) ?? '';
    const toolResults = lastUser.content;
    const summary = summarizeToolResults(originalQuestion, toolResults);
    yield* streamTokensAsEvents(summary);
    yield { type: 'turn_end', stopReason: 'end_turn' };
  }
}

// ============================================================================
// Helpers — selección de respuesta
// ============================================================================

/** Último mensaje con role='user' (texto plano). Si no hay, string vacío. */
function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

/** Último mensaje rich con role='user'. */
function lastRichUserMessage(
  messages: ChatRichMessage[],
): { role: 'user'; content: string | unknown[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i] as { role: 'user'; content: string | unknown[] };
    }
  }
  return null;
}

/** Primer user message con content string — la pregunta original del agente. */
function findEarliestUserQuestion(messages: ChatRichMessage[]): string | null {
  for (const m of messages) {
    if (m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return null;
}

/**
 * Elige respuesta para RAG/Comparator según keywords. Las respuestas
 * referencian los nombres de los documentos sample (rag-01, rag-02, rag-03,
 * cmp-01...) para que los tests puedan verificar que la respuesta cita
 * la fuente correcta.
 */
function pickRagResponse(text: string): string {
  const t = text.toLowerCase();

  // Comparator: el prompt típicamente contiene "compará" o "dimensiones".
  if (
    t.includes('compar') &&
    (t.includes('contrato') || t.includes('dimension'))
  ) {
    return [
      '| Dimensión | Contrato A | Contrato B |',
      '| --- | --- | --- |',
      '| Plazos de entrega | 120 días calendario | 180 días calendario |',
      '| Penalizaciones | 0.5% por día de atraso | 0.3% por día de atraso |',
      '',
      'Resumen: el contrato A es más exigente en plazos y penaliza más fuerte; el contrato B es más laxo en ambos ejes.',
    ].join('\n');
  }

  // RAG: 3 preguntas sugeridas de la app.
  if (
    t.includes('matrícula') ||
    t.includes('matricul') ||
    t.includes('enrollment') ||
    t.includes('enroll')
  ) {
    return 'Según el Manual de matrículas (sección 2), la ventana de matrícula ordinaria va del 1 al 15 de febrero para el primer semestre y del 1 al 15 de julio para el segundo. La matrícula extraordinaria, con recargo del 25%, se acepta hasta una semana después de cada cierre.';
  }
  if (
    t.includes('recalificación') ||
    t.includes('recalific') ||
    t.includes('grade review')
  ) {
    return 'Según el Reglamento académico (artículo 42), la recalificación se solicita por escrito al docente dentro de los 5 días hábiles posteriores a la publicación de la nota. Si el docente ratifica la nota y el estudiante mantiene desacuerdo, puede elevar el pedido al consejo de carrera, que designa un tribunal de tres docentes.';
  }
  if (
    t.includes('propiedad intelectual') ||
    t.includes('intellectual property')
  ) {
    return 'Según la Política de propiedad intelectual (capítulo II), la titularidad de los trabajos académicos producidos en el marco de la universidad corresponde conjuntamente al autor y a la institución. Los ingresos por explotación comercial se distribuyen 60% para el autor, 30% para la unidad académica y 10% para investigación.';
  }

  // Default: respuesta genérica pero útil — pista de que es el fake.
  return 'El sistema procesó tu consulta contra los documentos indexados, pero no encontró una sección que coincida claramente. Probá reformular la pregunta o agregar más contexto.';
}

/**
 * SQL determinístico para preguntas del Demo 04. Las preguntas sugeridas
 * de la UI usan keywords como "estudiantes", "Cálculo II", "reprobaron", etc.
 *
 * Importante: los SELECT que devolvemos tienen que ser válidos para el
 * SafeSqlExecutor (solo SELECT, identificadores citados con dobles comillas,
 * sobre las tablas reales del schema). Si fallan, los tests E2E lo atrapan.
 */
function pickSqlForQuestion(question: string): string {
  const q = question.toLowerCase();

  if (
    q.includes('total') &&
    (q.includes('estudiantes') || q.includes('students'))
  ) {
    return 'SELECT COUNT(*) AS total FROM "Student"';
  }
  if (
    q.includes('inscripciones') ||
    q.includes('enrollments') ||
    q.includes('más')
  ) {
    return 'SELECT c."name", COUNT(*) AS inscripciones FROM "Enrollment" e JOIN "Course" c ON c."id" = e."courseId" GROUP BY c."name" ORDER BY inscripciones DESC LIMIT 5';
  }
  if (
    q.includes('reprob') ||
    q.includes('failed') ||
    q.includes('cálculo') ||
    q.includes('calculo')
  ) {
    return 'SELECT COUNT(DISTINCT g."enrollmentId") AS reprobados FROM "Grade" g WHERE g."examType" = \'final\' AND g."score" < 60';
  }
  if (q.includes('promedio') || q.includes('gpa') || q.includes('average')) {
    return 'SELECT AVG(g."score") AS promedio FROM "Grade" g';
  }
  // Default seguro: cuenta de estudiantes — siempre devuelve algo.
  return 'SELECT COUNT(*) AS total FROM "Student"';
}

/**
 * Resumen en español de los resultados que el tool devolvió. Se inyecta el
 * texto del primer row como evidencia para que la respuesta sea creíble
 * (los tests pueden verificar que el resumen menciona el número real).
 */
function summarizeToolResults(
  question: string,
  toolResults: unknown[],
): string {
  // Buscamos el primer tool_result con content JSON parseable.
  for (const block of toolResults) {
    if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as { type: string }).type === 'tool_result' &&
      'content' in block
    ) {
      const content = (block as { content: string }).content;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0] as Record<string, unknown>;
          const firstValue = Object.values(first)[0];
          return (
            `Según los datos: ${formatValue(firstValue)}. ` +
            `(Pregunta original: "${question.slice(0, 80)}".)`
          );
        }
      } catch {
        // El content no es JSON parseable — probablemente un error.
      }
    }
  }
  return `No se obtuvieron datos para responder "${question.slice(0, 80)}".`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'sin datos';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

// ============================================================================
// Helpers — streaming sintético
// ============================================================================

/**
 * Trocea un string en "tokens" (sub-strings de 3-8 chars) y los emite uno
 * por uno. Simula el comportamiento de un LLM real que streama tokens.
 * No metemos delay artificial — la lentitud no aporta nada a los tests.
 */
async function* streamTokens(text: string): AsyncIterable<string> {
  // Split por word boundary preservando espacios. Cada "token" del fake es
  // aproximadamente una palabra — comportamiento parecido al de un BPE real.
  const tokens = text.match(/\S+\s*/g) ?? [text];
  for (const tok of tokens) {
    yield tok;
  }
}

async function* streamTokensAsEvents(
  text: string,
): AsyncIterable<AssistantStreamEvent> {
  for await (const tok of streamTokens(text)) {
    yield { type: 'text_delta', text: tok };
  }
}

/** Mismo djb2 que en fake-embeddings — duplicado para mantener cada fake
 * autocontenido (no queremos cross-imports entre providers). */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// ============================================================================
// Helpers — Demo 05 (tutor de inglés)
// ============================================================================

/**
 * Aproximación tokens ↔ chars. La regla de la industria es ~4 chars por token
 * para inglés/español (es lo que Anthropic y OpenAI documentan como heurística
 * para estimación previa). Útil cuando no hay proveedor real que reporte
 * usage exacto.
 */
function estimateTokens(chars: number): number {
  return Math.max(1, Math.round(chars / 4));
}

/**
 * Respuestas precableadas para Demo 05. El tutor responde a las pills
 * de la UI: saludo, pregunta sobre el fin de semana, pregunta sobre hobbies.
 * Si nada matchea devolvemos null y el caller cae al fallback genérico.
 */
function pickTutorResponse(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('weekend') || t.includes('fin de semana')) {
    return "That sounds nice! Tell me more — what did you do? Quick tip: when talking about the past, remember to use 'went' instead of 'go'.";
  }
  if (t.includes('hobby') || t.includes('hobbies')) {
    return 'Hobbies are a great topic. What do you enjoy doing in your free time? Try to describe one activity in detail.';
  }
  if (t.includes('coffee') || t.includes('café') || t.includes('order')) {
    return "Sure! Here's how a barista might respond: 'What size would you like, and is that for here or to go?' — Try ordering a small latte.";
  }
  if (t.includes('hello') || t.includes('hi') || t.includes('hola')) {
    return 'Hello! How are you today? Let me know what you would like to practice — small talk, ordering food, or a job interview.';
  }
  return null;
}
