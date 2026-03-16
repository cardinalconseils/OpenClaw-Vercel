/**
 * Hardcoded bilingual greeting constants for Murphy.
 *
 * These are NEVER LLM-generated. Hardcoded to guarantee FCC/TCPA compliance:
 * FCC 2024-2025 rules require AI disclosure at the start of every AI-generated
 * voice call. CA SB-1001 requires clear bot disclosure.
 *
 * The AI disclosure must appear before the first question mark in both languages.
 */

export const GREETING_TIMEOUT_MS = 2000;

export const GREETING: Record<'en' | 'fr', string> = {
  en: "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. What service can I help you find today?",
  fr: "Bonjour, je suis Murphy — un assistant IA d'OpenClaw Service Matchmaker. Quel service puis-je vous aider a trouver aujourd'hui?",
};
