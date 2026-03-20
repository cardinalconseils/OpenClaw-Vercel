/**
 * Appends voice-mode constraints to a base prompt.
 *
 * These rules enforce spoken-language norms so Murphy sounds natural
 * on a phone call — no markdown, no lists, short sentences.
 */
export function applyVoiceModifiers(basePrompt: string): string {
  const voiceRules = `
VOICE MODE — SPOKEN LANGUAGE RULES:
- No markdown formatting (no **, *, #, -, bullet points, numbered lists).
- Keep responses under 3 sentences unless the caller asks for more detail.
- Speak in short, natural spoken sentences — like you would on the phone.
- Never read out URLs, email addresses, or long alphanumeric strings verbatim.
- Use natural speech transitions: "Got it.", "One sec.", "Here's what I found." — not "Certainly!" or "Absolutely!".
- If you need to enumerate items, speak them as a comma-separated list in one sentence.
- Respond in the caller's detected language (English or French) for the entire call.
- If the caller speaks French, respond entirely in French. Do not switch to English mid-conversation.
`.trim();

  return `${basePrompt}\n\n${voiceRules}`;
}
