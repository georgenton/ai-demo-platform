// -----------------------------------------------------------------------------
// extractTip — pure helper que aísla la "💡 Tip: ..." en español que el tutor
// agrega al final de algunas respuestas.
//
// El system prompt del backend instruye al LLM:
//   "After your reply, if (and only if) the student's last message had a
//    clear grammar or word-choice mistake, add ONE concise correction at
//    the end, prefixed with "💡 Tip:" and written in Spanish."
//
// El frontend usa este helper para:
//   1) Pintar el tip en el panel de feedback (separado del chat).
//   2) Dejar el cuerpo del chat sin el tip (más limpio visualmente).
//
// El patrón puede variar levemente — el LLM a veces escribe "💡 **Tip:**" o
// "**💡 Tip:**". Cubrimos esas variantes para que el panel no quede vacío
// por una negrita extra.
// -----------------------------------------------------------------------------

export interface SplitMessage {
  /** Texto del mensaje sin el tip al final. Si no había tip, igual al original. */
  body: string;
  /** Texto del tip (sin el prefijo "💡 Tip:" ni asteriscos). Null si no había. */
  tip: string | null;
}

/** Variantes que aceptamos del prefijo del tip. */
const TIP_PREFIXES = [
  '💡 Tip:',
  '💡Tip:',
  '💡 **Tip:**',
  '**💡 Tip:**',
  '**💡Tip:**',
];

/**
 * Busca la primera ocurrencia de alguno de los prefijos y devuelve {body, tip}.
 * Si no encuentra ninguno, body = text, tip = null.
 *
 * Si el LLM puso varios tips (no debería, pero por las dudas), tomamos el
 * primero — el resto queda dentro del tip parseado.
 */
export function extractTip(text: string): SplitMessage {
  for (const prefix of TIP_PREFIXES) {
    const idx = text.indexOf(prefix);
    if (idx >= 0) {
      const body = text.slice(0, idx).trimEnd();
      const tip = text.slice(idx + prefix.length).trim();
      return { body, tip: tip || null };
    }
  }
  return { body: text, tip: null };
}
