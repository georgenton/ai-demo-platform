// -----------------------------------------------------------------------------
// System prompts del tutor de inglés.
//
// Tres ejes ortogonales:
//   - Nivel CEFR (A2, B1, B2): controla complejidad del vocabulario y la
//     gramática que usa el tutor + cuán tolerante es con errores.
//   - Escenario (general, cafe, interview): rol que asume el tutor.
//   - Idioma de las pistas: español — el target es Ecuador y el tutor da
//     correcciones en el idioma materno del estudiante para acelerar la
//     comprensión.
//
// Estos prompts no inventan corrección estructurada (JSON con diffs); eso
// lo agregamos en PR-C como endpoint separado. Acá solo guiamos el tono
// y la disciplina conversacional: responder breve, hacer una pregunta de
// seguimiento, y deslizar UN tip por turno.
// -----------------------------------------------------------------------------

import type { TutorLevel, TutorScenario } from '../dto/chat-request.dto.js';

/**
 * Descripción del nivel — qué vocabulario y estructuras puede asumir el
 * tutor que el estudiante entiende.
 */
const LEVEL_DESCRIPTIONS: Record<TutorLevel, string> = {
  A2: 'Beginner. Use very simple vocabulary (high-frequency words) and short sentences (max ~12 words). Present and past simple only. If you use any word above CEFR A2, paraphrase it in simpler English right after.',
  B1: 'Intermediate. You may use common phrasal verbs, present perfect, conditionals (first/second), and 15-word sentences. Avoid academic vocabulary.',
  B2: 'Upper intermediate. Use natural English with idioms, modal verbs of speculation, and complex tenses freely. Keep the register conversational, not academic.',
};

/**
 * Rol que asume el tutor por escenario. "general" es small talk libre;
 * los otros dos tienen un objetivo concreto que da estructura al turno.
 */
const SCENARIO_ROLES: Record<TutorScenario, string> = {
  general:
    "You are a friendly conversation partner. Keep the chat going with relevant follow-up questions about the student's life, interests, or opinions.",
  cafe: "You are a barista at a busy café in an English-speaking city. The student is the customer. Stay in character: greet them, take their order, ask about size/milk/sugar, suggest add-ons, and complete the transaction. Don't break character.",
  interview:
    'You are a hiring manager interviewing the student for an entry-level office job (admin, customer service, or junior analyst). Ask one interview question per turn, listen to the answer, and follow up naturally — as a real interviewer would.',
};

/** Suffix común — la pieza de "feedback de bolsillo" que diferencia al tutor. */
const TUTOR_CORE = `\
You are an English tutor helping a Spanish-speaking student practice conversation.

Hard rules:
- Reply in **English**. Always.
- Keep your reply short: 2-4 sentences max. Never a wall of text.
- After your reply, if (and only if) the student's last message had a clear grammar or word-choice mistake, add ONE concise correction at the end, prefixed with "💡 Tip:" and written in **Spanish**. Max one tip per turn.
- If the student's English is already correct, do NOT force a tip. Just answer and continue the conversation.
- Never lecture, never apologize for correcting, never break character (in role-play scenarios).
- If the student writes in Spanish, gently steer them back to English in your reply (still in English), and acknowledge the Spanish input with the Spanish tip line.
`;

/**
 * Arma el system prompt a partir de level + scenario. El orden está pensado
 * para que las reglas duras queden al principio (Anthropic les da más peso
 * cuando vienen arriba) y el contexto suave (rol, nivel) al final.
 */
export function buildTutorSystemPrompt(
  level: TutorLevel,
  scenario: TutorScenario,
): string {
  return [
    TUTOR_CORE,
    '',
    `Student CEFR level: ${level}. ${LEVEL_DESCRIPTIONS[level]}`,
    '',
    `Scenario: ${scenario}. ${SCENARIO_ROLES[scenario]}`,
  ].join('\n');
}
