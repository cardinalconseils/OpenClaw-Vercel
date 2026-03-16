/**
 * Centralized voice pipeline configuration constants.
 *
 * ElevenLabs voice format for Telnyx speak API: "ElevenLabs.Default.<voice_id>"
 * Adam voice: professional male, warm, narration-grade, French language support.
 */

/** ElevenLabs Adam voice ID — professional male, warm, multilingual */
export const ADAM_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

/** Telnyx speak API voice string format for ElevenLabs integration */
export const ELEVENLABS_VOICE_STRING = `ElevenLabs.Default.${ADAM_VOICE_ID}`;

/** Deepgram STT configuration for ClawdTalk skill-config */
export const DEEPGRAM_CONFIG = {
  provider: 'deepgram' as const,
  model: 'nova-3',
  language: 'multi',
  endpointing: 100,
  punctuate: true,
  interim_results: false,
};

/** ElevenLabs TTS configuration */
export const ELEVENLABS_CONFIG = {
  provider: 'elevenlabs' as const,
  model: 'eleven_flash_v2_5',
  voice_id: ADAM_VOICE_ID,
};

/** Call timeout in milliseconds — 10 minutes, long enough for multi-step provider search */
export const CALL_TIMEOUT_MS = 10 * 60 * 1000;

/** Session persistence window after disconnect — 30 minutes */
export const SESSION_PERSIST_MS = 30 * 60 * 1000;
