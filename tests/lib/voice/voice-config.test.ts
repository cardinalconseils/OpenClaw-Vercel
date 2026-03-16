import { describe, it, expect } from 'vitest';
import {
  TELNYX_VOICE_STRING,
  TELNYX_VOICE_SETTINGS,
  TELNYX_STT_CONFIG,
  SILENCE_NUDGE_MS,
  CALL_TIMEOUT_MS,
  SESSION_PERSIST_MS,
} from '../../../src/lib/voice/voice-config.js';

describe('voice-config — Telnyx-native constants', () => {
  it('TELNYX_VOICE_STRING equals Telnyx.KokoroTTS.am_adam', () => {
    expect(TELNYX_VOICE_STRING).toBe('Telnyx.KokoroTTS.am_adam');
  });

  it('TELNYX_VOICE_SETTINGS has type telnyx', () => {
    expect(TELNYX_VOICE_SETTINGS.type).toBe('telnyx');
  });

  it('TELNYX_VOICE_SETTINGS has voice_speed 0.95', () => {
    expect(TELNYX_VOICE_SETTINGS.voice_speed).toBe(0.95);
  });

  it('TELNYX_STT_CONFIG transcription_engine equals Telnyx', () => {
    expect(TELNYX_STT_CONFIG.transcription_engine).toBe('Telnyx');
  });

  it('TELNYX_STT_CONFIG transcription_engine_config.transcription_model equals openai/whisper-large-v3-turbo', () => {
    expect(TELNYX_STT_CONFIG.transcription_engine_config.transcription_model).toBe(
      'openai/whisper-large-v3-turbo'
    );
  });

  it('TELNYX_STT_CONFIG transcription_tracks equals inbound', () => {
    expect(TELNYX_STT_CONFIG.transcription_tracks).toBe('inbound');
  });

  it('SILENCE_NUDGE_MS equals 8000', () => {
    expect(SILENCE_NUDGE_MS).toBe(8000);
  });

  it('CALL_TIMEOUT_MS equals 600000', () => {
    expect(CALL_TIMEOUT_MS).toBe(600000);
  });

  it('SESSION_PERSIST_MS equals 1800000', () => {
    expect(SESSION_PERSIST_MS).toBe(1800000);
  });

  it('module does NOT export ELEVENLABS_VOICE_STRING', async () => {
    const mod = await import('../../../src/lib/voice/voice-config.js');
    expect((mod as any).ELEVENLABS_VOICE_STRING).toBeUndefined();
  });

  it('module does NOT export DEEPGRAM_CONFIG', async () => {
    const mod = await import('../../../src/lib/voice/voice-config.js');
    expect((mod as any).DEEPGRAM_CONFIG).toBeUndefined();
  });

  it('module does NOT export ADAM_VOICE_ID', async () => {
    const mod = await import('../../../src/lib/voice/voice-config.js');
    expect((mod as any).ADAM_VOICE_ID).toBeUndefined();
  });
});
