import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the telnyx client before any imports that depend on it
vi.mock('../../src/lib/voice/telnyx-client.js', () => ({
  telnyxClient: {
    webhooks: {
      unwrap: vi.fn(),
    },
  },
  getTelnyxClient: vi.fn(),
}));

// Mock call-state
vi.mock('../../src/lib/voice/call-state.js', () => ({
  initCall: vi.fn(),
  getCall: vi.fn(),
  updateCall: vi.fn(),
  endCall: vi.fn(),
  detectLanguage: vi.fn().mockReturnValue('en'),
  shouldAdvancePastClarification: vi.fn().mockReturnValue(false),
}));

// Mock intent-extractor
vi.mock('../../src/lib/ai/intent-extractor.js', () => ({
  extractIntent: vi.fn().mockReturnValue({
    serviceType: undefined,
    location: undefined,
    urgency: 'normal',
    isComplete: false,
  }),
  isIntentComplete: vi.fn().mockReturnValue(false),
  getDisambiguationPrompt: vi.fn().mockReturnValue('What kind of help do you need?'),
}));

// Mock orchestrator
vi.mock('../../src/lib/ai/orchestrator.js', () => ({
  chat: vi.fn().mockResolvedValue('ok'),
}));

import { telnyxClient, getTelnyxClient } from '../../src/lib/voice/telnyx-client.js';
import {
  initCall,
  getCall,
  updateCall,
  endCall,
  detectLanguage,
  shouldAdvancePastClarification,
} from '../../src/lib/voice/call-state.js';
import {
  extractIntent,
  isIntentComplete,
  getDisambiguationPrompt,
} from '../../src/lib/ai/intent-extractor.js';
import { GREETING } from '../../src/lib/voice/greeting.js';
import { ELEVENLABS_VOICE_STRING, SESSION_PERSIST_MS } from '../../src/lib/voice/voice-config.js';
import { app } from '../../src/server.js';

const mockUnwrap = vi.mocked(telnyxClient.webhooks.unwrap);
const mockGetTelnyxClient = vi.mocked(getTelnyxClient);

// Shared mock calls object — mirrors Telnyx SDK v6: calls.actions.answer / calls.actions.speak
const mockActions = {
  answer: vi.fn().mockResolvedValue({}),
  speak: vi.fn().mockResolvedValue({}),
};
const mockCalls = { actions: mockActions };

const VALID_PAYLOAD = JSON.stringify({
  data: {
    event_type: 'call.initiated',
    id: 'test-event-id',
    payload: {
      call_control_id: 'cc-123',
      call_leg_id: 'leg-456',
      call_session_id: 'session-789',
      from: '+15550001111',
      to: '+15550002222',
      state: 'parked',
      direction: 'inbound',
    },
  },
});

function makePayload(eventType: string, payloadOverrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    data: {
      event_type: eventType,
      id: 'test-event-id',
      payload: {
        call_control_id: 'cc-123',
        call_leg_id: 'leg-456',
        from: '+15550001111',
        to: '+15550002222',
        ...payloadOverrides,
      },
    },
  });
}

async function postWebhook(body: string) {
  return request(app)
    .post('/webhooks/telnyx')
    .set('Content-Type', 'application/json')
    .set('telnyx-signature-ed25519', 'valid-sig')
    .set('telnyx-timestamp', '1234567890')
    .send(body);
}

describe('POST /webhooks/telnyx', () => {
  beforeAll(() => {
    // Set a dummy public key so the server doesn't crash on startup
    process.env.TELNYX_API_KEY = 'test-api-key';
    process.env.TELNYX_PUBLIC_KEY = 'test-public-key';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockGetTelnyxClient.mockReturnValue({ calls: mockCalls } as any);
    mockActions.answer.mockResolvedValue({});
    mockActions.speak.mockResolvedValue({});
    vi.mocked(detectLanguage).mockReturnValue('en');
    vi.mocked(shouldAdvancePastClarification).mockReturnValue(false);
    vi.mocked(extractIntent).mockReturnValue({
      serviceType: undefined,
      location: undefined,
      urgency: 'normal',
      isComplete: false,
    });
    vi.mocked(isIntentComplete).mockReturnValue(false);
    vi.mocked(getDisambiguationPrompt).mockReturnValue('What kind of help do you need?');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ---- Original tests ----

  it('Test 1: POST /webhooks/telnyx with valid signature returns 200', async () => {
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.initiated' } } as any);

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('Test 2: POST /webhooks/telnyx with invalid signature returns 403', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Invalid signature'));

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'bad-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('Test 3: POST /webhooks/telnyx with missing signature headers returns 403', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Missing signature'));

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('Test 4: POST /webhooks/telnyx logs the event type from the parsed payload', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.answered' } } as any);

    await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    // Give async processing a tick to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('call.answered')
    );

    consoleSpy.mockRestore();
  });

  it('Test 5: GET /health returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('Test 6: Webhook route uses raw body parser (not express.json()) to preserve signature integrity', async () => {
    // Verify that the raw body is passed to unwrap as a string, not a parsed object.
    // The mock unwrap captures what it was called with.
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.initiated' } } as any);

    await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    // unwrap should have been called with the raw body string
    expect(mockUnwrap).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.any(Object) })
    );

    const calledWith = mockUnwrap.mock.calls[0][0] as unknown;
    expect(typeof calledWith).toBe('string');
  });

  // ---- New lifecycle tests ----

  it('Test 7: call.initiated event triggers calls.answer', async () => {
    const body = makePayload('call.initiated');
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockActions.answer).toHaveBeenCalledWith('cc-123', expect.any(Object));
  });

  it('Test 8: call.answered event calls initCall and speaks greeting', async () => {
    const body = makePayload('call.answered');
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(initCall)).toHaveBeenCalledWith('cc-123', '+15550001111');
    expect(mockActions.speak).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({
        payload: GREETING.en,
        voice: ELEVENLABS_VOICE_STRING,
      })
    );
  });

  it('Test 9: call.transcription with complete intent advances to searching', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'intake',
      intent: {},
      clarificationTurns: 0,
      startedAt: new Date(),
    });
    vi.mocked(extractIntent).mockReturnValue({
      serviceType: 'plumber',
      location: 'Austin',
      urgency: 'normal',
      isComplete: true,
    });
    vi.mocked(isIntentComplete).mockReturnValue(true);

    const body = makePayload('call.transcription', {
      transcription_data: {
        transcript: 'I need a plumber in Austin',
        words: [{ word: 'plumber', language: 'en' }],
      },
    });
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(updateCall)).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({ stage: 'searching' })
    );
    expect(mockActions.speak).toHaveBeenCalled();
  });

  it('Test 10: call.transcription with incomplete intent and 0 clarifications asks disambiguation', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'intake',
      intent: {},
      clarificationTurns: 0,
      startedAt: new Date(),
    });
    vi.mocked(extractIntent).mockReturnValue({
      serviceType: undefined,
      location: undefined,
      urgency: 'normal',
      isComplete: false,
    });
    vi.mocked(isIntentComplete).mockReturnValue(false);
    vi.mocked(shouldAdvancePastClarification).mockReturnValue(false);
    vi.mocked(getDisambiguationPrompt).mockReturnValue('What kind of help do you need?');

    const body = makePayload('call.transcription', {
      transcription_data: {
        transcript: 'I need help',
        words: [{ word: 'help', language: 'en' }],
      },
    });
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockActions.speak).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({ payload: 'What kind of help do you need?' })
    );
    expect(vi.mocked(updateCall)).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({ clarificationTurns: 1 })
    );
  });

  it('Test 11: call.transcription with incomplete intent and 1 clarification forces advance', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'intake',
      intent: {},
      clarificationTurns: 1,
      startedAt: new Date(),
    });
    vi.mocked(extractIntent).mockReturnValue({
      serviceType: undefined,
      location: undefined,
      urgency: 'normal',
      isComplete: false,
    });
    vi.mocked(isIntentComplete).mockReturnValue(false);
    vi.mocked(shouldAdvancePastClarification).mockReturnValue(true);

    const body = makePayload('call.transcription', {
      transcription_data: {
        transcript: 'I still need something',
        words: [{ word: 'still', language: 'en' }],
      },
    });
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(updateCall)).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({ stage: 'searching' })
    );
  });

  it('Test 12: call.transcription calls detectLanguage on first utterance', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'intake',
      intent: {},
      clarificationTurns: 0,
      startedAt: new Date(),
    });
    vi.mocked(detectLanguage).mockReturnValue('fr');
    vi.mocked(extractIntent).mockReturnValue({
      serviceType: undefined,
      location: undefined,
      urgency: 'normal',
      isComplete: false,
    });
    vi.mocked(isIntentComplete).mockReturnValue(false);
    vi.mocked(shouldAdvancePastClarification).mockReturnValue(false);

    const words = [{ word: 'bonjour', language: 'fr' }];
    const body = makePayload('call.transcription', {
      transcription_data: {
        transcript: 'Bonjour',
        words,
      },
    });
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(detectLanguage)).toHaveBeenCalledWith(words);
    expect(vi.mocked(updateCall)).toHaveBeenCalledWith(
      'cc-123',
      expect.objectContaining({ language: 'fr' })
    );
  });

  it('Test 13: call.hangup with incomplete call delays endCall', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'intake',
      intent: {},
      clarificationTurns: 0,
      startedAt: new Date(),
    });

    // Capture the setTimeout callback so we can invoke it manually
    let capturedCallback: (() => void) | undefined;
    let capturedDelay: number | undefined;
    const originalSetTimeout = global.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementationOnce((fn: (...args: unknown[]) => void, delay?: number) => {
        capturedCallback = fn as () => void;
        capturedDelay = delay;
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

    const body = makePayload('call.hangup');
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    // Give setImmediate time to fire — use original setTimeout to avoid spy interference
    await new Promise<void>((r) => originalSetTimeout(r, 50));

    setTimeoutSpy.mockRestore();

    // endCall should NOT be called immediately
    expect(vi.mocked(endCall)).not.toHaveBeenCalled();
    // Delay should be SESSION_PERSIST_MS
    expect(capturedDelay).toBe(SESSION_PERSIST_MS);
    // Invoke the captured callback to simulate timer firing
    capturedCallback?.();
    expect(vi.mocked(endCall)).toHaveBeenCalledWith('cc-123');
  });

  it('Test 14: call.hangup with completed call calls endCall immediately', async () => {
    vi.mocked(getCall).mockReturnValue({
      callControlId: 'cc-123',
      callerPhone: '+15550001111',
      language: 'en',
      stage: 'complete',
      intent: {},
      clarificationTurns: 0,
      startedAt: new Date(),
    });

    const body = makePayload('call.hangup');
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    await postWebhook(body);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(endCall)).toHaveBeenCalledWith('cc-123');
  });

  it('Test 15: unknown event type does not throw', async () => {
    const body = makePayload('call.recording');
    mockUnwrap.mockResolvedValueOnce(JSON.parse(body) as any);

    const res = await postWebhook(body);
    expect(res.status).toBe(200);
    // No assertion about throws — just confirming 200 and no crash
    await new Promise((r) => setTimeout(r, 50));
  });
});
