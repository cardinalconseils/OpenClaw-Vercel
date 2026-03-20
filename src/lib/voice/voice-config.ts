/**
 * Centralized voice pipeline configuration — Telnyx-native TTS and STT.
 *
 * All voice constants target Telnyx Call Control v2 built-in capabilities.
 * No external TTS (ElevenLabs) or STT (Deepgram) dependencies.
 */

/** Telnyx KokoroTTS voice — warm American male matching Murphy persona */
export const TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam';

/** Telnyx voice settings — slight slowdown for clarity on telephone audio */
export const TELNYX_VOICE_SETTINGS = { type: 'telnyx' as const, voice_speed: 0.95 };

/** Telnyx STT configuration — Whisper-based, English, inbound track only */
export const TELNYX_STT_CONFIG = {
  transcription_engine: 'Telnyx' as const,
  transcription_engine_config: {
    transcription_engine: 'Telnyx' as const,
    transcription_model: 'openai/whisper-large-v3-turbo' as const,
    language: 'en' as const,
  },
  transcription_tracks: 'inbound' as const,
};

/** Silence nudge threshold in milliseconds — fires "Still there?" after 8s */
export const SILENCE_NUDGE_MS = 8_000;

/** Call timeout in milliseconds — 10 minutes */
export const CALL_TIMEOUT_MS = 10 * 60 * 1000;

/** Provider ring timeout — move to next provider after 25s unanswered (~5 rings) */
export const PROVIDER_RING_TIMEOUT_MS = 25_000;

/** Provider ring timeout in integer seconds for Telnyx timeout_secs parameter */
export const PROVIDER_RING_TIMEOUT_SECS = 25;

/** Maximum providers to try before declaring no match */
export const MAX_CASCADE_PROVIDERS = 4;

/** Interval between user status updates during provider dialing (17s is within 15-20s locked window) */
export const NARRATION_INTERVAL_MS = 17_000;

/** Session persistence window after disconnect — 30 minutes */
export const SESSION_PERSIST_MS = 30 * 60 * 1000;
